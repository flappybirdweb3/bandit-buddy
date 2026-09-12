// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TreasuryBuyBack
 * @notice Accumulates $FARM from platform fees and subscriptions.
 *         Owner triggers buy-back: swaps accumulated BNB for $FARM via PancakeSwap,
 *         then burns the purchased FARM (deflationary mechanism).
 *
 * Flow:
 *   1. BanditMarket / subscription contracts transfer $FARM fees here.
 *   2. Owner (or keeper bot) calls executeBuyBack() periodically.
 *   3. Contract swaps BNB for $FARM on PancakeSwap V2, then burns.
 *
 * Note: FARM can also be sent directly here for a simpler burn-only path.
 */
contract TreasuryBuyBack is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20  public immutable farmToken;
    address public immutable pancakeRouter; // PancakeSwap V2 router
    address public immutable wbnb;

    uint256 public totalBurned;
    uint256 public slippageBps = 200; // 2% max slippage

    event BuyBackExecuted(uint256 bnbSpent, uint256 farmBurned);
    event DirectBurn(uint256 farmBurned);
    event SlippageUpdated(uint256 newBps);
    event FundsReceived(address indexed from, uint256 amount);

    error InsufficientBalance();
    error SlippageTooHigh();

    constructor(
        address _farmToken,
        address _pancakeRouter,
        address _wbnb,
        address _owner
    ) Ownable(_owner) {
        farmToken     = IERC20(_farmToken);
        pancakeRouter = _pancakeRouter;
        wbnb          = _wbnb;
    }

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    /**
     * Swap BNB in contract for $FARM, then burn. Called by keeper bot.
     *
     * MODIFIER ORDER — access → lock → state, and it must not change:
     *   - onlyOwner first rejects unauthorised callers before any SSTORE. A re-entrant
     *     callback from the router is never the owner, so it dies at this gate.
     *   - nonReentrant then holds the lock across BOTH external calls (getAmountsOut and
     *     swapExactETHForTokens) and the burn. Moving it after the swap defeats it.
     *   - whenNotPaused last. Its exact position is immaterial (a revert rolls back the
     *     lock) but keeping it adjacent to the body reads as the state gate.
     *
     * @param bnbAmount BNB to swap (must be > 0 and ≤ contract balance).
     * @param minFarmOut Caller's floor. The EFFECTIVE floor is the stricter of this and the
     *                   slippageBps-derived quote floor, so passing 0 no longer disables
     *                   slippage protection.
     */
    function executeBuyBack(uint256 bnbAmount, uint256 minFarmOut)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        // A zero-value swap is either a no-op or a router revert; reject it up front.
        if (bnbAmount == 0) revert InsufficientBalance();
        if (address(this).balance < bnbAmount) revert InsufficientBalance();

        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = address(farmToken);

        // slippageBps was previously declared and settable but NEVER read — the only floor
        // was the caller-supplied minFarmOut, so a keeper passing 0 accepted any fill, and
        // the acquired FARM is burned immediately, making the loss permanent.
        // getAmountsOut is declared `view`, so the compiler emits STATICCALL and the quote
        // cannot re-enter. Quote and swap execute in the same transaction, so the floor is
        // measured against the exact price the swap will see.
        uint256[] memory quote = IPancakeRouter(pancakeRouter).getAmountsOut(bnbAmount, path);
        uint256 quoteFloor = (quote[1] * (10_000 - slippageBps)) / 10_000;
        uint256 effectiveMinOut = quoteFloor > minFarmOut ? quoteFloor : minFarmOut;

        uint256 balBefore = farmToken.balanceOf(address(this));

        IPancakeRouter(pancakeRouter).swapExactETHForTokens{value: bnbAmount}(
            effectiveMinOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 purchased = farmToken.balanceOf(address(this)) - balBefore;
        _burnFarm(purchased);

        emit BuyBackExecuted(bnbAmount, purchased);
    }

    /**
     * Burn any $FARM already held by this contract (direct fee routing).
     */
    function burnHeldFarm() external onlyOwner nonReentrant {
        uint256 balance = farmToken.balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();
        _burnFarm(balance);
        emit DirectBurn(balance);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _burnFarm(uint256 amount) internal {
        totalBurned += amount;
        IBurnable(address(farmToken)).burn(amount);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setSlippage(uint256 _bps) external onlyOwner {
        if (_bps > 1000) revert SlippageTooHigh();
        slippageBps = _bps;
        emit SlippageUpdated(_bps);
    }

    /** Emergency: recover accidentally sent tokens (not FARM — use burnHeldFarm). */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(farmToken), "Use burnHeldFarm");
        IERC20(token).safeTransfer(owner(), amount);
    }

    function recoverBNB(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner()).call{value: amount}("");
        require(ok, "BNB transfer failed");
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

interface IPancakeRouter {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    /// @dev Declared `view` on purpose: Solidity then emits STATICCALL, so this quote
    ///      cannot re-enter the buyback even if `pancakeRouter` were ever untrusted.
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface IBurnable {
    function burn(uint256 amount) external;
}
