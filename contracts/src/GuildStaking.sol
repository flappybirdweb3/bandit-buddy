// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GuildStaking
 * @notice Members stake $FARM to fund their guild. Elite tier requires
 *         minEliteStake total staked in the guild.
 *
 * Mechanics:
 *   - Any user stakes $FARM to a guild (identified by guildId UUID hashed to bytes32).
 *   - guildTotalStaked[guildId] tracks aggregate stake.
 *   - Backend reads isEliteEligible() off-chain to gate Elite tier.
 *   - Harvest-tax GOLD flows off-chain through backend; $FARM portion is optional
 *     but the contract accepts depositHarvestTax() for on-chain settlement.
 *   - Users can unstake after UNSTAKE_DELAY (7 days) to prevent guild-hop farming.
 *
 * Risk vectors addressed:
 *   - Flash-staking: UNSTAKE_DELAY prevents same-tx stake/unstake.
 *   - Guild drain: guildTotalStaked only increases on stake, decreases on unstake.
 *   - Reentrancy: nonReentrant guard + CEI pattern.
 *   - Access control: only owner can set minEliteStake.
 */
contract GuildStaking is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable farmToken;

    uint256 public minEliteStake  = 500 * 10 ** 18;  // 500 FARM to reach Elite
    uint256 public constant UNSTAKE_DELAY = 7 days;

    struct StakeInfo {
        uint256 amount;
        uint256 unstakedAt; // timestamp when unstake was requested (0 = not requested)
    }

    // guildId (bytes32 from UUID) => user => stake
    mapping(bytes32 => mapping(address => StakeInfo)) public stakes;
    // guildId => total staked
    mapping(bytes32 => uint256) public guildTotalStaked;

    event Staked(bytes32 indexed guildId, address indexed user, uint256 amount);
    event UnstakeRequested(bytes32 indexed guildId, address indexed user, uint256 amount);
    event Unstaked(bytes32 indexed guildId, address indexed user, uint256 amount);
    event HarvestTaxDeposited(bytes32 indexed guildId, address indexed depositor, uint256 amount);
    event MinEliteStakeUpdated(uint256 newMin);

    error ZeroAmount();
    error AlreadyRequestedUnstake();
    error UnstakeNotRequested();
    error UnstakeLocked();
    error NothingToUnstake();

    constructor(address _farmToken, address _owner) Ownable(_owner) {
        farmToken = IERC20(_farmToken);
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    function stake(bytes32 guildId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        farmToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage s = stakes[guildId][msg.sender];
        s.amount += amount;
        s.unstakedAt = 0; // cancel any pending unstake
        guildTotalStaked[guildId] += amount;

        emit Staked(guildId, msg.sender, amount);
    }

    function requestUnstake(bytes32 guildId) external nonReentrant {
        StakeInfo storage s = stakes[guildId][msg.sender];
        if (s.amount == 0) revert NothingToUnstake();
        if (s.unstakedAt != 0) revert AlreadyRequestedUnstake();
        s.unstakedAt = block.timestamp;
        emit UnstakeRequested(guildId, msg.sender, s.amount);
    }

    function unstake(bytes32 guildId) external nonReentrant {
        StakeInfo storage s = stakes[guildId][msg.sender];
        if (s.unstakedAt == 0)  revert UnstakeNotRequested();
        if (block.timestamp < s.unstakedAt + UNSTAKE_DELAY) revert UnstakeLocked();

        uint256 amount = s.amount;
        guildTotalStaked[guildId] -= amount;
        s.amount      = 0;
        s.unstakedAt  = 0;

        farmToken.safeTransfer(msg.sender, amount);
        emit Unstaked(guildId, msg.sender, amount);
    }

    /**
     * Harvest tax deposited by backend (optional on-chain settlement).
     * Stays in contract; guild owner can call distributeTax off-chain.
     */
    function depositHarvestTax(bytes32 guildId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        farmToken.safeTransferFrom(msg.sender, address(this), amount);
        emit HarvestTaxDeposited(guildId, msg.sender, amount);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function isEliteEligible(bytes32 guildId) external view returns (bool) {
        return guildTotalStaked[guildId] >= minEliteStake;
    }

    function userStake(bytes32 guildId, address user) external view returns (uint256) {
        return stakes[guildId][user].amount;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setMinEliteStake(uint256 _min) external onlyOwner {
        minEliteStake = _min;
        emit MinEliteStakeUpdated(_min);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
