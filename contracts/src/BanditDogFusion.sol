// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BanditDogFusion
 * @notice Guard Dog Gacha using Commit-Reveal RNG.
 *
 * Tiers (token IDs from GuardDogNFT):
 *   1 Chihuahua  10%  — 60% weight
 *   2 Corgi      20%  — 24% weight
 *   3 Husky      35%  — 10% weight
 *   4 Rottweiler 50%  —  4% weight
 *   5 Doberman   65%  —  1.5% weight
 *   6 Pitbull    80%  —  0.5% weight
 *
 * Pity: guaranteed Tier ≥3 after 10 consecutive non-Tier-3+ pulls.
 *
 * Flow:
 *   1. Player commits: commit(commitment = keccak256(abi.encodePacked(secret, msg.sender)))
 *   2. After MIN_REVEAL_BLOCKS, player reveals: reveal(secret)
 *   3. Contract uses block.prevrandao + secret + commitment to resolve tier.
 *   4. GuardDogNFT.mint(player, resolvedTokenId, 1) is called.
 *   5. $FARM payment (PULL_COST) is burned.
 *
 * Security:
 *   - Commit-reveal prevents miner manipulation on the commit block.
 *   - Commitment must be revealed within REVEAL_WINDOW blocks to prevent griefing.
 */
contract BanditDogFusion is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ── External contracts ───────────────────────────────────────────────────
    IERC20  public immutable farmToken;
    IMintableNFT public nftContract;

    // ── Config ───────────────────────────────────────────────────────────────
    uint256 public pullCost = 50 * 10 ** 18;       // 50 FARM per pull
    uint256 public constant MIN_REVEAL_BLOCKS = 2;
    uint256 public constant REVEAL_WINDOW = 256;   // ~13 min on BSC; after that commit expires

    // ── Cumulative weights (out of 10000) ────────────────────────────────────
    // Tier:  1      2      3      4      5     6
    uint16[6] public weights = [6000, 8400, 9400, 9800, 9950, 10000];

    // ── State ────────────────────────────────────────────────────────────────
    struct PendingPull {
        bytes32 commitment;
        uint256 commitBlock;
        bool    revealed;
    }

    mapping(address => PendingPull) public pendingPulls;
    mapping(address => uint256)     public pityCounter; // resets on Tier ≥3 pull

    // ── Events ───────────────────────────────────────────────────────────────
    event Committed(address indexed player, bytes32 commitment, uint256 commitBlock);
    event Revealed(address indexed player, uint256 indexed tokenId, uint256 pity);
    event PullCostUpdated(uint256 newCost);

    // ── Errors ───────────────────────────────────────────────────────────────
    error AlreadyPending();
    error NoPendingCommit();
    error TooEarly();
    error CommitExpired();
    error WrongSecret();

    constructor(address _farmToken, address _nftContract, address _owner)
        Ownable(_owner)
    {
        farmToken   = IERC20(_farmToken);
        nftContract = IMintableNFT(_nftContract);
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    /**
     * Step 1: player locks $FARM and submits commitment.
     * @param commitment keccak256(abi.encodePacked(secret, msg.sender))
     */
    function commit(bytes32 commitment) external nonReentrant whenNotPaused {
        if (pendingPulls[msg.sender].commitBlock != 0 && !pendingPulls[msg.sender].revealed)
            revert AlreadyPending();

        farmToken.safeTransferFrom(msg.sender, address(this), pullCost);
        // Burn immediately — no refunds (ensures cost is sunk before RNG)
        _burn(pullCost);

        pendingPulls[msg.sender] = PendingPull({
            commitment:  commitment,
            commitBlock: block.number,
            revealed:    false
        });
        emit Committed(msg.sender, commitment, block.number);
    }

    /**
     * Step 2: player reveals secret, contract mints NFT.
     * @param secret The pre-image used in commitment.
     */
    function reveal(bytes32 secret) external nonReentrant whenNotPaused {
        PendingPull storage pull = pendingPulls[msg.sender];
        if (pull.commitBlock == 0 || pull.revealed) revert NoPendingCommit();

        uint256 elapsed = block.number - pull.commitBlock;
        if (elapsed < MIN_REVEAL_BLOCKS) revert TooEarly();
        if (elapsed > REVEAL_WINDOW)     revert CommitExpired();

        bytes32 expected = keccak256(abi.encodePacked(secret, msg.sender));
        if (expected != pull.commitment) revert WrongSecret();

        pull.revealed = true;

        // RNG: mix block.prevrandao of (commitBlock+1) via blockhash, secret, and sender
        bytes32 rand = keccak256(abi.encodePacked(
            blockhash(pull.commitBlock + 1),
            secret,
            msg.sender
        ));

        uint256 tokenId = _resolveTokenId(uint256(rand), msg.sender);

        // Pity: if tier < 3, increment counter; at 10 force tier 3
        if (tokenId < 3) {
            pityCounter[msg.sender]++;
        } else {
            pityCounter[msg.sender] = 0;
        }

        emit Revealed(msg.sender, tokenId, pityCounter[msg.sender]);
        nftContract.mint(msg.sender, tokenId, 1, "");
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _resolveTokenId(uint256 rand, address player) internal view returns (uint256) {
        // Pity override
        if (pityCounter[player] >= 10) return 3;

        uint256 roll = rand % 10_000;
        for (uint256 i = 0; i < 6; i++) {
            if (roll < weights[i]) return i + 1;
        }
        return 6;
    }

    function _burn(uint256 amount) internal {
        // FarmToken implements burn(); cast and call
        IBurnable(address(farmToken)).burn(amount);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setPullCost(uint256 _cost) external onlyOwner { pullCost = _cost; emit PullCostUpdated(_cost); }
    function setWeights(uint16[6] calldata _w) external onlyOwner { weights = _w; }
    function setNftContract(address _nft) external onlyOwner { nftContract = IMintableNFT(_nft); }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

// ── Minimal interfaces ────────────────────────────────────────────────────────

interface IMintableNFT {
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
}

interface IBurnable {
    function burn(uint256 amount) external;
}
