// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FarmTokenClaim
 * @notice Gate for players to convert off-chain GOLD into on-chain $FARM.
 *
 * Flow:
 *   1. Player earns GOLD in-game (off-chain).
 *   2. Player calls POST /web3/claim-signature on the Game Server.
 *   3. Game Server validates trust_score, deducts GOLD, generates ECDSA sig:
 *        messageHash = keccak256(abi.encodePacked(
 *                          block.chainid, address(this), player, amountWei, nonce))
 *        signature   = adminWallet.signMessage(getBytes(messageHash))  // ethers v6
 *   4. Player calls claimTokens(amount, nonce, signature) here.
 *   5. Contract verifies sig → marks nonce used → transfers FARM.
 *
 * Security properties:
 *   - Replay protection: per-(address,nonce) used bitmap.
 *   - Domain separation: block.chainid and address(this) are bound into the signed digest,
 *     so a signature is valid only on THIS chain and THIS deployment. A testnet signature
 *     can never be replayed on mainnet even when the backend signer key is shared.
 *   - Reentrancy guard: CEI pattern + nonReentrant.
 *   - Signer rotation: owner can update signer (key rotation, incident response).
 *   - Pause: owner can freeze claims in emergency.
 *   - SafeERC20: handles non-standard token edge cases.
 *   - Min/max claim bounds: prevents dust and whale drain.
 */
contract FarmTokenClaim is ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20 public immutable farmToken;
    address public signerAddress;

    uint256 public minClaimAmount = 1 * 10 ** 18;       // 1 FARM
    uint256 public maxClaimAmount = 100_000 * 10 ** 18; // 100k FARM per tx
    uint256 public totalClaimed;

    // Anti-replay: (user => (nonce => used))
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // ─── Events ──────────────────────────────────────────────────────────────
    event TokensClaimed(
        address indexed user,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event PoolFunded(address indexed funder, uint256 amount);
    event ClaimBoundsUpdated(uint256 minAmount, uint256 maxAmount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error NonceAlreadyUsed(address user, uint256 nonce);
    error InvalidSignature();
    error AmountOutOfBounds(uint256 amount, uint256 min, uint256 max);
    error InsufficientPoolBalance(uint256 available, uint256 requested);
    error ZeroAddress();

    constructor(
        address _farmToken,
        address _signerAddress,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_farmToken == address(0) || _signerAddress == address(0) || _initialOwner == address(0))
            revert ZeroAddress();
        farmToken = IERC20(_farmToken);
        signerAddress = _signerAddress;
    }

    // ─── Core claim function ─────────────────────────────────────────────────

    /**
     * @notice Claim $FARM using a backend-signed ECDSA signature.
     * @param amount    Token amount in wei (18 decimals). Must match signature.
     * @param nonce     Monotonically increasing per-user nonce from backend DB.
     * @param signature Compact ECDSA signature (65 bytes) from the signer wallet.
     *
     * The signer must have produced (identical to hashMessage() below — do not duplicate
     * the pre-image here, it is the exact thing that drifted before):
     *   bytes32 hash = keccak256(abi.encodePacked(
     *                      block.chainid, address(this), msg.sender, amount, nonce));
     *   bytes32 eth  = MessageHashUtils.toEthSignedMessageHash(hash);
     *   signature    = ECDSA.sign(eth, signerPrivKey);
     */
    function claimTokens(
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // 1. Bounds check
        if (amount < minClaimAmount || amount > maxClaimAmount)
            revert AmountOutOfBounds(amount, minClaimAmount, maxClaimAmount);

        // 2. Replay protection (CHECKS first)
        if (usedNonces[msg.sender][nonce])
            revert NonceAlreadyUsed(msg.sender, nonce);

        // 3. Signature verification — digest is domain-bound to (chainid, this contract).
        //    Delegating to hashMessage() keeps signing and verification in lockstep: the
        //    backend can reproduce the digest via the same public view, so the two sides
        //    can never drift apart again.
        (, bytes32 ethSignedHash) = hashMessage(msg.sender, amount, nonce);
        address recovered = ethSignedHash.recover(signature);
        if (recovered != signerAddress) revert InvalidSignature();

        // 4. Pool liquidity check
        uint256 available = farmToken.balanceOf(address(this));
        if (available < amount)
            revert InsufficientPoolBalance(available, amount);

        // 5. EFFECTS before external call
        usedNonces[msg.sender][nonce] = true;
        totalClaimed += amount;

        // 6. INTERACTION last (SafeERC20 handles revert on failure)
        farmToken.safeTransfer(msg.sender, amount);

        emit TokensClaimed(msg.sender, amount, nonce, block.timestamp);
    }

    // ─── Admin functions ─────────────────────────────────────────────────────

    function fundPool(uint256 amount) external onlyOwner {
        farmToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit SignerUpdated(signerAddress, newSigner);
        signerAddress = newSigner;
    }

    function setClaimBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax >= newMin, "Invalid bounds");
        minClaimAmount = newMin;
        maxClaimAmount = newMax;
        emit ClaimBoundsUpdated(newMin, newMax);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        farmToken.safeTransfer(owner(), amount);
        emit EmergencyWithdraw(owner(), amount);
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    function poolBalance() external view returns (uint256) {
        return farmToken.balanceOf(address(this));
    }

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    /**
     * @dev Reproduce the exact digest the backend must sign — and the one claimTokens()
     *      verifies. Public (not external) so claimTokens can call it internally.
     *
     *      DOMAIN SEPARATION: block.chainid and address(this) are prepended to the
     *      pre-image, so a signature minted for one chain (e.g. BSC testnet 97) cannot be
     *      replayed on another (e.g. mainnet 56), nor against a redeployed instance of
     *      this contract — even when the same backend signer key is used everywhere.
     *
     *      abi.encodePacked is safe here: every argument is fixed-width (uint256 /
     *      address), so the concatenation is injective and there is no dynamic-type
     *      ambiguity to exploit.
     *
     *      `view`, not `pure` — block.chainid and address(this) are read at runtime.
     *      NOTE: the return tuple is preserved (messageHash, ethSignedHash) so existing
     *      callers and tests keep compiling.
     */
    function hashMessage(
        address user,
        uint256 amount,
        uint256 nonce
    ) public view returns (bytes32 messageHash, bytes32 ethSignedHash) {
        messageHash = keccak256(
            abi.encodePacked(block.chainid, address(this), user, amount, nonce)
        );
        ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
    }
}
