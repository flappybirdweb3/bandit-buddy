// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FarmVesting.sol";

/**
 * @title  FarmTokenSale
 * @notice Three-round $FARM token sale: Angel → Private → Public (IDO).
 *
 * Flow per purchase
 * ─────────────────
 *   1. Buyer approves USDT to this contract.
 *   2. Buyer calls buy(roundId, usdtAmount).
 *   3. Contract validates round, whitelist, caps.
 *   4. USDT transferred from buyer → treasury.
 *   5. FARM calculated from price.
 *   6. FARM transferred from this contract → FarmVesting.
 *   7. FarmVesting.addSchedule() called with buyer's vesting terms.
 *
 * Round parameters (hardcoded at deploy, but updatable before round opens)
 * ─────────────────────────────────────────────────────────────────────────
 *   ANGEL   (0): $0.001/FARM  | 5% supply (50M)  | 0% TGE | 90d cliff | 540d vesting
 *   PRIVATE (1): $0.0025/FARM | 7% supply (70M)  | 5% TGE | 0d cliff  | 540d vesting
 *   PUBLIC  (2): $0.005/FARM  | 5% supply (50M)  | 25% TGE| 0d cliff  | 365d vesting
 *
 * All amounts use 18-decimal precision (BSC stablecoins are 18 decimals).
 */
contract FarmTokenSale is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────── Constants ───────────────

    uint8 public constant ROUND_ANGEL   = 0;
    uint8 public constant ROUND_PRIVATE = 1;
    uint8 public constant ROUND_PUBLIC  = 2;
    uint8 public constant ROUND_COUNT   = 3;

    uint256 private constant BPS_DENOM = 10_000;

    // ─────────────── Immutables ───────────────

    IERC20       public immutable usdt;
    IERC20       public immutable farm;
    FarmVesting  public immutable vesting;
    address      public treasury; // USDT proceeds destination

    // ─────────────── Round config ───────────────

    struct RoundConfig {
        uint256 priceWei;          // USDT per FARM (both 18 decimals). e.g. 1e15 = $0.001
        uint256 totalAllocation;   // max FARM tokens for this round
        uint256 sold;              // FARM sold so far
        uint64  startTime;         // unix timestamp
        uint64  endTime;           // unix timestamp
        bool    requiresWhitelist;
        uint256 tgeBps;            // TGE unlock in bps (500 = 5%)
        uint32  cliffDays;         // days from TGE before linear vesting starts
        uint32  vestingDays;       // days of linear vesting after cliff
        uint256 minUsdtAmount;     // minimum buy in USDT (18 dec)
        uint256 maxUsdtPerWallet;  // max cumulative USDT per wallet (18 dec)
        string  label;             // e.g. "angel", "private", "public"
    }

    RoundConfig[ROUND_COUNT] public rounds;

    // Whitelist: roundId => buyer => isWhitelisted
    mapping(uint8 => mapping(address => bool)) public whitelist;

    // Per-wallet cumulative USDT spent: roundId => buyer => total
    mapping(uint8 => mapping(address => uint256)) public spent;

    // ─────────────── Events ───────────────

    event Purchased(
        address indexed buyer,
        uint8   indexed roundId,
        uint256 usdtPaid,
        uint256 farmAmount,
        uint256 vestingIndex
    );
    event WhitelistUpdated(uint8 indexed roundId, address indexed account, bool status);
    event RoundUpdated(uint8 indexed roundId);
    event TreasuryUpdated(address indexed treasury);
    event FarmRecovered(address indexed to, uint256 amount);

    // ─────────────── Errors ───────────────

    error RoundNotActive();
    error NotWhitelisted();
    error BelowMinPurchase();
    error ExceedsWalletCap();
    error ExceedsRoundAllocation();
    error ZeroAmount();
    error ZeroAddress();
    error InvalidRound();
    error RoundAlreadyStarted();

    // ─────────────── Constructor ───────────────

    constructor(
        address _usdt,
        address _farm,
        address _vesting,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        if (_usdt == address(0) || _farm == address(0) || _vesting == address(0) ||
            _treasury == address(0) || _owner == address(0)) revert ZeroAddress();

        usdt     = IERC20(_usdt);
        farm     = IERC20(_farm);
        vesting  = FarmVesting(_vesting);
        treasury = _treasury;

        // ─── Default round configuration (V3 Tokenomics — 2026-09-18) ───
        // ANGEL: $0.001 | 50M FARM | 5% TGE | 90-day cliff | 18-month (540d) vesting
        rounds[ROUND_ANGEL] = RoundConfig({
            priceWei:         1e15,               // 0.001 USDT (18 dec)
            totalAllocation:  50_000_000 * 1e18,  // 50M FARM
            sold:             0,
            startTime:        0,                  // set via setRoundTimes()
            endTime:          0,
            requiresWhitelist: true,
            tgeBps:           500,                // 5% at TGE (V3 fix)
            cliffDays:        90,                 // 3-month cliff
            vestingDays:      540,                // 18-month linear
            minUsdtAmount:    100 * 1e18,         // min $100
            maxUsdtPerWallet: 5_000 * 1e18,       // max $5,000 (anti-whale)
            label:            "angel"
        });

        // PRIVATE: $0.0025 | 70M FARM | 5% TGE | 30-day cliff | 18-month vesting
        rounds[ROUND_PRIVATE] = RoundConfig({
            priceWei:         2_500_000_000_000_000, // 0.0025 USDT
            totalAllocation:  70_000_000 * 1e18,     // 70M FARM
            sold:             0,
            startTime:        0,
            endTime:          0,
            requiresWhitelist: true,
            tgeBps:           500,               // 5% at TGE
            cliffDays:        30,               // 1-month cliff (V3 fix)
            vestingDays:      540,               // 18-month linear
            minUsdtAmount:    500 * 1e18,        // min $500
            maxUsdtPerWallet: 20_000 * 1e18,     // max $20,000
            label:            "private"
        });

        // PUBLIC: $0.005 | 50M FARM | 25% TGE | no cliff | 12-month vesting
        rounds[ROUND_PUBLIC] = RoundConfig({
            priceWei:         5_000_000_000_000_000, // 0.005 USDT
            totalAllocation:  50_000_000 * 1e18,     // 50M FARM
            sold:             0,
            startTime:        0,
            endTime:          0,
            requiresWhitelist: false,
            tgeBps:           2_500,             // 25% at TGE
            cliffDays:        0,
            vestingDays:      365,               // 12-month linear
            minUsdtAmount:    10 * 1e18,         // min $10
            maxUsdtPerWallet: 2_000 * 1e18,      // max $2,000
            label:            "public"
        });
    }

    // ─────────────── Core: buy ───────────────

    /**
     * @notice Purchase $FARM in the specified round.
     *         Buyer must approve USDT to this contract first.
     *
     * @param roundId    0=Angel, 1=Private, 2=Public
     * @param usdtAmount Amount of USDT to spend (18 decimals)
     */
    function buy(uint8 roundId, uint256 usdtAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 farmAmount, uint256 vestingIndex)
    {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        if (usdtAmount == 0) revert ZeroAmount();

        RoundConfig storage r = rounds[roundId];

        // Round must be active
        if (block.timestamp < r.startTime || block.timestamp > r.endTime || r.endTime == 0)
            revert RoundNotActive();

        // Whitelist check
        if (r.requiresWhitelist && !whitelist[roundId][msg.sender])
            revert NotWhitelisted();

        // Minimum purchase
        if (usdtAmount < r.minUsdtAmount) revert BelowMinPurchase();

        // Per-wallet cap
        uint256 newSpent = spent[roundId][msg.sender] + usdtAmount;
        if (newSpent > r.maxUsdtPerWallet) revert ExceedsWalletCap();

        // Calculate FARM: farmAmount = usdtAmount * 1e18 / priceWei
        farmAmount = (usdtAmount * 1e18) / r.priceWei;

        // Round allocation check
        if (r.sold + farmAmount > r.totalAllocation) revert ExceedsRoundAllocation();

        // ── Effects ──
        r.sold += farmAmount;
        spent[roundId][msg.sender] = newSpent;

        // ── Interactions ──
        // 1. Collect USDT from buyer
        usdt.safeTransferFrom(msg.sender, treasury, usdtAmount);

        // 2. Transfer FARM to FarmVesting (must be pre-approved by this contract's owner)
        farm.safeTransfer(address(vesting), farmAmount);

        // 3. Create vesting schedule
        vestingIndex = vesting.addSchedule(
            msg.sender,
            farmAmount,
            r.tgeBps,
            r.cliffDays,
            r.vestingDays,
            r.label
        );

        emit Purchased(msg.sender, roundId, usdtAmount, farmAmount, vestingIndex);
    }

    // ─────────────── Admin: round management ───────────────

    /**
     * @notice Set start/end time for a round.
     *         Cannot change a round that has already started.
     */
    function setRoundTimes(uint8 roundId, uint64 startTime, uint64 endTime) external onlyOwner {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        RoundConfig storage r = rounds[roundId];
        if (r.startTime != 0 && block.timestamp >= r.startTime) revert RoundAlreadyStarted();
        require(endTime > startTime, "endTime <= startTime");
        r.startTime = startTime;
        r.endTime   = endTime;
        emit RoundUpdated(roundId);
    }

    /**
     * @notice Update a round's price and allocation (only before it starts).
     */
    function setRoundParams(
        uint8   roundId,
        uint256 priceWei,
        uint256 totalAllocation,
        uint256 minUsdtAmount,
        uint256 maxUsdtPerWallet
    ) external onlyOwner {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        RoundConfig storage r = rounds[roundId];
        if (r.startTime != 0 && block.timestamp >= r.startTime) revert RoundAlreadyStarted();
        require(priceWei > 0, "price = 0");
        r.priceWei        = priceWei;
        r.totalAllocation = totalAllocation;
        r.minUsdtAmount   = minUsdtAmount;
        r.maxUsdtPerWallet = maxUsdtPerWallet;
        emit RoundUpdated(roundId);
    }

    // ─────────────── Admin: whitelist ───────────────

    function addToWhitelist(uint8 roundId, address[] calldata accounts) external onlyOwner {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        for (uint256 i; i < accounts.length; ++i) {
            whitelist[roundId][accounts[i]] = true;
            emit WhitelistUpdated(roundId, accounts[i], true);
        }
    }

    function removeFromWhitelist(uint8 roundId, address[] calldata accounts) external onlyOwner {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        for (uint256 i; i < accounts.length; ++i) {
            whitelist[roundId][accounts[i]] = false;
            emit WhitelistUpdated(roundId, accounts[i], false);
        }
    }

    // ─────────────── Admin: treasury ───────────────

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ─────────────── Emergency ───────────────

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Recover unsold FARM tokens after rounds end (e.g., send to Ecosystem pool).
     */
    function recoverFarm(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = farm.balanceOf(address(this));
        require(amount <= balance, "amount > balance");
        farm.safeTransfer(to, amount);
        emit FarmRecovered(to, amount);
    }

    // ─────────────── View helpers ───────────────

    /**
     * @notice Returns true if `account` can currently buy in `roundId`.
     */
    function canBuy(uint8 roundId, address account) external view returns (bool, string memory reason) {
        if (roundId >= ROUND_COUNT) return (false, "invalid round");
        RoundConfig storage r = rounds[roundId];
        if (r.endTime == 0 || block.timestamp < r.startTime) return (false, "not started");
        if (block.timestamp > r.endTime) return (false, "ended");
        if (r.requiresWhitelist && !whitelist[roundId][account]) return (false, "not whitelisted");
        if (r.sold >= r.totalAllocation) return (false, "sold out");
        if (spent[roundId][account] >= r.maxUsdtPerWallet) return (false, "wallet cap reached");
        return (true, "");
    }

    /**
     * @notice Calculate FARM amount for a given USDT spend.
     */
    function farmForUsdt(uint8 roundId, uint256 usdtAmount) external view returns (uint256) {
        if (roundId >= ROUND_COUNT) revert InvalidRound();
        return (usdtAmount * 1e18) / rounds[roundId].priceWei;
    }

    /**
     * @notice Available FARM remaining in a round.
     */
    function remaining(uint8 roundId) external view returns (uint256) {
        if (roundId >= ROUND_COUNT) return 0;
        RoundConfig storage r = rounds[roundId];
        return r.totalAllocation > r.sold ? r.totalAllocation - r.sold : 0;
    }

    /**
     * @notice Summary info for all three rounds (for frontend).
     */
    function allRoundsSummary() external view returns (
        uint256[3] memory prices,
        uint256[3] memory allocations,
        uint256[3] memory soldAmounts,
        uint64[3]  memory startTimes,
        uint64[3]  memory endTimes,
        uint256[3] memory tgeBpsArr,
        uint32[3]  memory cliffDaysArr,
        uint32[3]  memory vestingDaysArr
    ) {
        for (uint8 i; i < ROUND_COUNT; ++i) {
            RoundConfig storage r = rounds[i];
            prices[i]       = r.priceWei;
            allocations[i]  = r.totalAllocation;
            soldAmounts[i]  = r.sold;
            startTimes[i]   = r.startTime;
            endTimes[i]     = r.endTime;
            tgeBpsArr[i]    = r.tgeBps;
            cliffDaysArr[i] = r.cliffDays;
            vestingDaysArr[i] = r.vestingDays;
        }
    }
}
