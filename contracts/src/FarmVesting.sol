// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  FarmVesting
 * @notice Multi-beneficiary, multi-schedule linear vesting for $FARM token.
 *
 * Schedule flow
 * ─────────────
 *   TGE timestamp set by admin once.
 *
 *   For each schedule:
 *     [now]                [TGE]         [TGE + cliff]            [TGE + cliff + vesting]
 *       |___________________|_______________|___________________________|
 *                           ^ tgeAmount unlocked immediately here
 *                                           ^ linear portion begins
 *                                                                       ^ 100% unlocked
 *
 * Use cases
 * ─────────
 *   - Sale rounds: created by FarmTokenSale (CREATOR_ROLE)
 *   - Team & Advisors: created manually by admin (CREATOR_ROLE)
 *   - Ecosystem vaults, Treasury: created manually by admin
 *
 * FARM tokens must be deposited into this contract (by the caller or admin)
 * before or alongside calling addSchedule().
 */
contract FarmVesting is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────── Roles ───────────────

    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    // ─────────────── State ───────────────

    IERC20  public immutable farm;
    uint64  public tgeTimestamp; // 0 until admin calls setTge()

    struct VestingSchedule {
        uint256 totalAmount;  // total FARM in this schedule (includes TGE portion)
        uint256 tgeAmount;    // unlocked at (or after) TGE, before cliff
        uint32  cliffDays;    // cliff duration in days from TGE
        uint32  vestingDays;  // linear vesting duration in days after cliff
        uint256 released;     // cumulative amount already claimed
        string  label;        // human-readable category ("angel","private","public","team",…)
    }

    mapping(address => VestingSchedule[]) private _schedules;

    uint256 public totalAllocated; // sum of all schedules' totalAmount
    uint256 public totalReleased;  // sum of all releases so far

    // ─────────────── Events ───────────────

    event TgeSet(uint64 timestamp);
    event ScheduleAdded(
        address indexed beneficiary,
        uint256 indexed index,
        uint256 totalAmount,
        uint256 tgeAmount,
        uint32  cliffDays,
        uint32  vestingDays,
        string  label
    );
    event Released(address indexed beneficiary, uint256 indexed index, uint256 amount);
    event FarmDeposited(address indexed from, uint256 amount);

    // ─────────────── Errors ───────────────

    error TgeAlreadySet();
    error TgeNotSet();
    error ZeroAddress();
    error ZeroAmount();
    error TgeBpsExceedsMax();
    error NothingToRelease();
    error InsufficientFarmBalance();

    // ─────────────── Constructor ───────────────

    constructor(address _farm, address _admin) {
        if (_farm == address(0) || _admin == address(0)) revert ZeroAddress();
        farm = IERC20(_farm);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CREATOR_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    // ─────────────── Admin functions ───────────────

    /**
     * @notice Sets the TGE (Token Generation Event) timestamp. Can only be called once.
     */
    function setTge(uint64 timestamp) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (tgeTimestamp != 0) revert TgeAlreadySet();
        tgeTimestamp = timestamp;
        emit TgeSet(timestamp);
    }

    /**
     * @notice Deposits FARM tokens into this contract to cover vesting schedules.
     *         Admin or CREATOR_ROLE callers (e.g., FarmTokenSale) can pre-fund.
     */
    function depositFarm(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        farm.safeTransferFrom(msg.sender, address(this), amount);
        emit FarmDeposited(msg.sender, amount);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─────────────── Schedule management ───────────────

    /**
     * @notice Creates a new vesting schedule for `beneficiary`.
     *         Caller must hold CREATOR_ROLE and ensure FARM is already in this contract.
     *
     * @param beneficiary   Wallet that will claim the tokens.
     * @param totalAmount   Total FARM in this schedule (18 decimals).
     * @param tgeBps        Percentage unlocked at TGE, in basis points (500 = 5%).
     * @param cliffDays     Days from TGE before linear vesting starts. 0 = no cliff.
     * @param vestingDays   Days of linear vesting after cliff. 0 = all at TGE.
     * @param label         Category string for off-chain tracking.
     * @return index        Index of the new schedule in beneficiary's array.
     */
    function addSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 tgeBps,
        uint32  cliffDays,
        uint32  vestingDays,
        string calldata label
    ) external onlyRole(CREATOR_ROLE) whenNotPaused returns (uint256 index) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        if (tgeBps > 10_000) revert TgeBpsExceedsMax();

        // Sanity: contract must have enough unallocated FARM
        uint256 balance = farm.balanceOf(address(this));
        if (balance < totalAllocated - totalReleased + totalAmount) revert InsufficientFarmBalance();

        uint256 tgeAmt = (totalAmount * tgeBps) / 10_000;

        _schedules[beneficiary].push(VestingSchedule({
            totalAmount: totalAmount,
            tgeAmount:   tgeAmt,
            cliffDays:   cliffDays,
            vestingDays: vestingDays,
            released:    0,
            label:       label
        }));

        index = _schedules[beneficiary].length - 1;
        totalAllocated += totalAmount;

        emit ScheduleAdded(beneficiary, index, totalAmount, tgeAmt, cliffDays, vestingDays, label);
    }

    // ─────────────── Claim functions ───────────────

    /**
     * @notice Releases all currently claimable FARM to `beneficiary`.
     *         Anyone can call this on behalf of any beneficiary.
     */
    function release(address beneficiary) external nonReentrant whenNotPaused returns (uint256 totalSent) {
        uint64 tge = tgeTimestamp;
        if (tge == 0) revert TgeNotSet();

        VestingSchedule[] storage list = _schedules[beneficiary];
        uint256 len = list.length;
        for (uint256 i; i < len; ++i) {
            uint256 amount = _releasable(list[i], tge);
            if (amount > 0) {
                list[i].released += amount;
                totalSent += amount;
                emit Released(beneficiary, i, amount);
            }
        }

        if (totalSent == 0) revert NothingToRelease();
        totalReleased += totalSent;
        farm.safeTransfer(beneficiary, totalSent);
    }

    /**
     * @notice Releases a single schedule by index.
     */
    function releaseSchedule(address beneficiary, uint256 index) external nonReentrant whenNotPaused returns (uint256 amount) {
        uint64 tge = tgeTimestamp;
        if (tge == 0) revert TgeNotSet();

        VestingSchedule storage s = _schedules[beneficiary][index];
        amount = _releasable(s, tge);
        if (amount == 0) revert NothingToRelease();

        s.released += amount;
        totalReleased += amount;

        emit Released(beneficiary, index, amount);
        farm.safeTransfer(beneficiary, amount);
    }

    // ─────────────── View functions ───────────────

    /**
     * @notice Total FARM claimable right now for a beneficiary (across all schedules).
     */
    function releasable(address beneficiary) external view returns (uint256 total) {
        uint64 tge = tgeTimestamp;
        if (tge == 0) return 0;
        VestingSchedule[] storage list = _schedules[beneficiary];
        for (uint256 i; i < list.length; ++i) {
            total += _releasable(list[i], tge);
        }
    }

    /**
     * @notice Number of schedules for a beneficiary.
     */
    function scheduleCount(address beneficiary) external view returns (uint256) {
        return _schedules[beneficiary].length;
    }

    /**
     * @notice Get a specific schedule by beneficiary + index.
     */
    function getSchedule(address beneficiary, uint256 index) external view returns (
        uint256 totalAmount,
        uint256 tgeAmount,
        uint32  cliffDays,
        uint32  vestingDays,
        uint256 released,
        uint256 claimableNow,
        string memory label
    ) {
        VestingSchedule storage s = _schedules[beneficiary][index];
        uint64 tge = tgeTimestamp;
        return (
            s.totalAmount,
            s.tgeAmount,
            s.cliffDays,
            s.vestingDays,
            s.released,
            tge == 0 ? 0 : _releasable(s, tge),
            s.label
        );
    }

    /**
     * @notice Get all schedules for a beneficiary (for frontend display).
     */
    function getAllSchedules(address beneficiary) external view returns (
        uint256[] memory totalAmounts,
        uint256[] memory tgeAmounts,
        uint32[]  memory cliffDaysArr,
        uint32[]  memory vestingDaysArr,
        uint256[] memory releasedArr,
        uint256[] memory claimableArr,
        string[]  memory labels
    ) {
        VestingSchedule[] storage list = _schedules[beneficiary];
        uint256 len = list.length;
        uint64 tge = tgeTimestamp;

        totalAmounts   = new uint256[](len);
        tgeAmounts     = new uint256[](len);
        cliffDaysArr   = new uint32[](len);
        vestingDaysArr = new uint32[](len);
        releasedArr    = new uint256[](len);
        claimableArr   = new uint256[](len);
        labels         = new string[](len);

        for (uint256 i; i < len; ++i) {
            VestingSchedule storage s = list[i];
            totalAmounts[i]   = s.totalAmount;
            tgeAmounts[i]     = s.tgeAmount;
            cliffDaysArr[i]   = s.cliffDays;
            vestingDaysArr[i] = s.vestingDays;
            releasedArr[i]    = s.released;
            claimableArr[i]   = tge == 0 ? 0 : _releasable(s, tge);
            labels[i]         = s.label;
        }
    }

    // ─────────────── Internal helpers ───────────────

    function _releasable(VestingSchedule storage s, uint64 tge) private view returns (uint256) {
        uint256 now_ = block.timestamp;
        if (now_ < tge) return 0;

        uint64 cliffEnd   = tge + uint64(s.cliffDays)   * 1 days;
        uint64 vestingEnd = cliffEnd + uint64(s.vestingDays) * 1 days;

        uint256 vested;
        if (s.vestingDays == 0 || now_ >= vestingEnd) {
            // Fully vested (or no vesting period: 100% at/after TGE)
            vested = s.totalAmount;
        } else if (now_ >= cliffEnd) {
            // In linear vesting window
            uint256 vestingTotal = s.totalAmount - s.tgeAmount;
            uint256 elapsed = now_ - cliffEnd;
            uint256 duration = uint64(s.vestingDays) * 1 days;
            vested = s.tgeAmount + (vestingTotal * elapsed) / duration;
        } else {
            // After TGE, before cliff: only TGE portion available
            vested = s.tgeAmount;
        }

        return vested > s.released ? vested - s.released : 0;
    }
}
