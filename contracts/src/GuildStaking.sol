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

    uint256 public minEliteStake  = 1000 * 10 ** 18;  // 1,000 FARM to reach Elite / Premium tier
    uint256 public constant UNSTAKE_DELAY = 7 days;

    struct StakeInfo {
        uint256 amount;
        uint256 unstakedAt; // timestamp when unstake was requested (0 = not requested)
    }

    // guildId (bytes32 from UUID) => user => stake
    mapping(bytes32 => mapping(address => StakeInfo)) public stakes;
    // guildId => total staked
    mapping(bytes32 => uint256) public guildTotalStaked;
    // guildId => total accumulated harvest tax
    mapping(bytes32 => uint256) public guildHarvestTax;

    event Staked(bytes32 indexed guildId, address indexed user, uint256 amount);
    event UnstakeRequested(bytes32 indexed guildId, address indexed user, uint256 amount);
    event Unstaked(bytes32 indexed guildId, address indexed user, uint256 amount);
    event HarvestTaxDeposited(bytes32 indexed guildId, address indexed depositor, uint256 amount);
    event HarvestTaxClaimed(bytes32 indexed guildId, address indexed recipient, uint256 amount);
    event GuildRewardClaimed(bytes32 indexed guildId, address indexed recipient, uint256 amount);
    event MinEliteStakeUpdated(uint256 newMin);

    error ZeroAmount();
    error AlreadyRequestedUnstake();
    error UnstakeNotRequested();
    error UnstakeLocked();
    error NothingToUnstake();
    error ZeroAddress();
    error InsufficientTaxBalance();

    constructor(address _farmToken, address _owner) Ownable(_owner) {
        if (_farmToken == address(0) || _owner == address(0)) revert ZeroAddress();
        farmToken = IERC20(_farmToken);
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    /**
     * @notice Stake 1,000 FARM to create / upgrade a guild to Elite (Premium) tier.
     */
    function stakeToCreateGuild(bytes32 guildId) external nonReentrant whenNotPaused {
        uint256 amount = minEliteStake;
        farmToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage s = stakes[guildId][msg.sender];
        s.amount += amount;
        s.unstakedAt = 0; // cancel any pending unstake
        guildTotalStaked[guildId] += amount;

        emit Staked(guildId, msg.sender, amount);
    }

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
     * Harvest tax deposited by backend (on-chain settlement).
     * Tracks per-guild accumulated tax balance.
     */
    function depositHarvestTax(bytes32 guildId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        farmToken.safeTransferFrom(msg.sender, address(this), amount);
        guildHarvestTax[guildId] += amount;
        emit HarvestTaxDeposited(guildId, msg.sender, amount);
    }

    /**
     * @notice Distribute or claim accumulated harvest tax for a guild.
     * Callable by contract owner (admin/governance).
     */
    function claimHarvestTax(bytes32 guildId, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (guildHarvestTax[guildId] < amount) revert InsufficientTaxBalance();

        guildHarvestTax[guildId] -= amount;
        farmToken.safeTransfer(recipient, amount);
        emit HarvestTaxClaimed(guildId, recipient, amount);
    }

    /**
     * @notice Claim guild tree reward when the World Tree is ripe.
     * Callable by contract owner / backend relayer upon Proof of Contribution verification.
     */
    function claimGuildReward(bytes32 guildId, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        farmToken.safeTransfer(recipient, amount);
        emit GuildRewardClaimed(guildId, recipient, amount);
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
