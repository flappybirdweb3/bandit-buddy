// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TreasuryBuyBack
 * @notice Deflationary Treasury & Tokenomics Protection Vault for Bandit Buddy ($FARM).
 *         Accepts BNB revenues from game services, premium perks, and NFT marketplace fees.
 *         Once the treasury accumulates >= buyBackThreshold (default 2 BNB), the buy-back
 *         mechanism swaps accumulated BNB for $FARM via PancakeSwap V2 Router and routes
 *         the purchased tokens directly to the dead address (0x...dEaD) for permanent burn.
 *
 * Requirements & Specifications:
 *   - Auto Buy-back & Burn PRD (AUTO_BUYBACK_AND_BURN.MD)
 *   - Uses swapExactETHForTokensSupportingFeeOnTransferTokens (FARM has dynamic fee-on-transfer tax)
 *   - Destination address is strictly 0x000000000000000000000000000000000000dEaD
 *   - Emits BuyBackAndBurned(bnbSpent, farmBurned) for verifiable Proof of Burn
 */
contract TreasuryBuyBack is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    IERC20  public immutable farmToken;
    address public immutable pancakeRouter; // PancakeSwap V2 router
    address public immutable wbnb;

    uint256 public buyBackThreshold = 2 ether; // Default: 2 BNB
    uint256 public slippageBps = 600;          // Default: 6% slippage (accommodates 3% fee-on-transfer tax + 3% price impact)
    uint256 public totalBurned;                // Cumulative $FARM tokens burned
    uint256 public totalBnbSpent;              // Cumulative BNB spent on buybacks

    event BuyBackAndBurned(uint256 indexed bnbSpent, uint256 indexed farmBurned);
    event DirectBurn(uint256 farmBurned);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldBps, uint256 newBps);
    event FundsReceived(address indexed from, uint256 amount);

    error InsufficientBalance();
    error ThresholdNotReached(uint256 currentBalance, uint256 threshold);
    error SlippageTooHigh();
    error InvalidAddress();
    error ZeroAmount();

    constructor(
        address _farmToken,
        address _pancakeRouter,
        address _wbnb,
        address _owner
    ) Ownable(_owner) {
        if (_farmToken == address(0) || _pancakeRouter == address(0) || _wbnb == address(0)) {
            revert InvalidAddress();
        }
        farmToken     = IERC20(_farmToken);
        pancakeRouter = _pancakeRouter;
        wbnb          = _wbnb;
    }

    /**
     * @notice Accepts BNB revenue from game services, marketplace fees, and deposits.
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    // ── Core Buy-back & Burn Functions ──────────────────────────────────────────

    /**
     * @notice Automated Buy-back & Burn triggered by backend worker or keeper bot.
     *         Can be called when contract balance >= buyBackThreshold.
     *         Swaps all contract BNB for $FARM and sends directly to the DEAD address.
     */
    function triggerBuyBack()
        external
        nonReentrant
        whenNotPaused
    {
        uint256 bnbToSpend = address(this).balance;
        if (bnbToSpend < buyBackThreshold) {
            revert ThresholdNotReached(bnbToSpend, buyBackThreshold);
        }

        _executeSwapAndBurn(bnbToSpend, 0);
    }

    /**
     * @notice Manual Buy-back & Burn executed by the owner/admin.
     * @param bnbAmount Exact BNB amount to spend.
     * @param minFarmOut Optional minimum $FARM required (slippage floor).
     */
    function executeBuyBack(uint256 bnbAmount, uint256 minFarmOut)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        if (bnbAmount == 0) revert ZeroAmount();
        if (address(this).balance < bnbAmount) revert InsufficientBalance();

        _executeSwapAndBurn(bnbAmount, minFarmOut);
    }

    /**
     * @dev Internal swap execution using PancakeSwap V2 Router.
     *      MUST use swapExactETHForTokensSupportingFeeOnTransferTokens because $FARM
     *      implements a dynamic transfer tax.
     */
    function _executeSwapAndBurn(uint256 bnbAmount, uint256 minFarmOut) internal {
        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = address(farmToken);

        // Calculate dynamic slippage floor from onchain quote
        uint256[] memory quote = IPancakeRouter02(pancakeRouter).getAmountsOut(bnbAmount, path);
        uint256 quoteFloor = (quote[1] * (10_000 - slippageBps)) / 10_000;
        uint256 effectiveMinOut = quoteFloor > minFarmOut ? quoteFloor : minFarmOut;

        uint256 deadBalBefore = farmToken.balanceOf(DEAD_ADDRESS);

        // Execute swap directly to DEAD address for immediate deflation & DexScreener burn candle
        IPancakeRouter02(pancakeRouter).swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnbAmount}(
            effectiveMinOut,
            path,
            DEAD_ADDRESS,
            block.timestamp + 300
        );

        uint256 farmBurned = farmToken.balanceOf(DEAD_ADDRESS) - deadBalBefore;
        totalBurned += farmBurned;
        totalBnbSpent += bnbAmount;

        emit BuyBackAndBurned(bnbAmount, farmBurned);
    }

    /**
     * @notice Burns any $FARM tokens directly held by this contract (from fee routing).
     */
    function burnHeldFarm() external onlyOwner nonReentrant {
        uint256 balance = farmToken.balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();

        farmToken.safeTransfer(DEAD_ADDRESS, balance);
        totalBurned += balance;

        emit DirectBurn(balance);
    }

    // ── Configuration & Admin ──────────────────────────────────────────────────

    /**
     * @notice Updates the accumulation trigger threshold (e.g., 1 ether, 2 ether).
     */
    function setBuyBackThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0) revert ZeroAmount();
        emit ThresholdUpdated(buyBackThreshold, newThreshold);
        buyBackThreshold = newThreshold;
    }

    /**
     * @notice Updates the maximum slippage tolerance in basis points (100 = 1%).
     */
    function setSlippage(uint256 _bps) external onlyOwner {
        if (_bps > 1000) revert SlippageTooHigh(); // Max 10%
        emit SlippageUpdated(slippageBps, _bps);
        slippageBps = _bps;
    }

    /**
     * @notice Emergency recovery for accidentally sent ERC-20 tokens (excluding $FARM).
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(farmToken), "Use burnHeldFarm");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Emergency recovery for BNB.
     */
    function recoverBNB(uint256 amount) external onlyOwner {
        if (amount == 0 || address(this).balance < amount) revert InsufficientBalance();
        (bool ok,) = payable(owner()).call{value: amount}("");
        require(ok, "BNB transfer failed");
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

interface IPancakeRouter02 {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}
