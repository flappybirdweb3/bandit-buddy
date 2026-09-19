// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WalletGateway
 * @notice In-App Decentralized Wallet Gateway for BarnBuddy (FarmHeist).
 *         Routes outgoing transfers (BNB & Tokens) originating from the Mini App UI:
 *         1. BNB transfers: 0.3% fee is routed to TreasuryBuyBack Vault to accumulate
 *            towards the 2.0 BNB auto-buyback threshold.
 *         2. $FARM transfers: 0.3% fee is routed directly to the Black Hole / DEAD address
 *            (0x000000000000000000000000000000000000dEaD) for instant permanent burn!
 *         3. Other tokens (USDT, BUSD): 0.3% fee is routed to the Treasury Vault.
 *         4. FARM → USDT cashout: atomic swap via PancakeSwap with 1% fee forwarded to
 *            Treasury Vault (SA ADR-01 Option B — prevents client-side fee bypass).
 *
 * Requirements & Specifications:
 *   - PRD: WALLET_FUNCTION_ADDED.MD
 *   - SA Architecture Sign-off: USDT_TO_VAULD_SA_FB.MD (ADR-01 Option B mandatory)
 *   - Black Hole / Burn Address: 0x000000000000000000000000000000000000dEaD
 *   - Transfer Fee BPS: 30 BPS (0.3%)
 *   - Cashout Fee BPS: 100 BPS (1%) — higher to limit capital flight from the game economy
 *   - Safety Ceiling: MAX_FEE_BPS = 100 BPS (1%)
 */
contract WalletGateway is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address payable public immutable treasuryVault;
    address public immutable farmToken;
    address public immutable usdtToken;
    address public immutable pancakeRouter;
    address public immutable wbnb;

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public feeBps = 30;            // 30 BPS = 0.3% (P2P transfer fee)
    uint256 public constant MAX_FEE_BPS = 100; // 1% max safety ceiling
    uint256 public constant CASHOUT_FEE_BPS = 100; // 1% FARM→USDT cashout tax (SA ADR-02)

    event BNBTransferRouted(
        address indexed sender,
        address indexed recipient,
        uint256 totalAmount,
        uint256 feeAmount,
        uint256 netAmount
    );

    event TokenTransferRouted(
        address indexed sender,
        address indexed token,
        address indexed recipient,
        address feeDestination,
        uint256 totalAmount,
        uint256 feeAmount,
        uint256 netAmount
    );

    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    // SA ADR-01: emitted for every atomic FARM→USDT cashout
    event FarmCashedOut(
        address indexed seller,
        uint256 farmIn,
        uint256 usdtOut,
        uint256 fee,
        uint256 netUsdt
    );

    error InvalidAddress();
    error ZeroAmount();
    error TransferFailed();
    error FeeTooHigh();

    constructor(
        address payable _treasuryVault,
        address _farmToken,
        address _pancakeRouter,
        address _usdtToken,
        address _wbnb,
        address _owner
    ) Ownable(_owner) {
        if (
            _treasuryVault == address(0) ||
            _farmToken == address(0) ||
            _pancakeRouter == address(0) ||
            _usdtToken == address(0) ||
            _wbnb == address(0)
        ) revert InvalidAddress();

        treasuryVault = _treasuryVault;
        farmToken     = _farmToken;
        pancakeRouter = _pancakeRouter;
        usdtToken     = _usdtToken;
        wbnb          = _wbnb;
    }

    // ── P2P Transfer Routing ────────────────────────────────────────────────────

    /**
     * @notice Route BNB transfer with 0.3% gateway fee sent to Treasury Vault.
     *         Accumulates towards the 2.0 BNB threshold for auto-buyback and burn.
     * @param to Recipient destination address.
     */
    function routeBNBTransfer(address to) external payable nonReentrant {
        if (to == address(0) || to == address(this)) revert InvalidAddress();
        if (msg.value == 0) revert ZeroAmount();

        uint256 fee = (msg.value * feeBps) / FEE_DENOMINATOR;
        uint256 netAmount = msg.value - fee;

        if (fee > 0) {
            (bool feeSuccess, ) = treasuryVault.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        (bool recipientSuccess, ) = to.call{value: netAmount}("");
        if (!recipientSuccess) revert TransferFailed();

        emit BNBTransferRouted(msg.sender, to, msg.value, fee, netAmount);
    }

    /**
     * @notice Route ERC-20 token transfer:
     *         - If token is $FARM: 0.3% fee is routed directly to DEAD address (instant burn)
     *         - If other token: 0.3% fee is routed to the Treasury Vault
     * @param token Address of the ERC-20 token.
     * @param to Recipient destination address.
     * @param amount Total amount to transfer.
     */
    function routeTokenTransfer(address token, address to, uint256 amount) external nonReentrant {
        if (token == address(0) || to == address(0) || to == address(this)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 fee = (amount * feeBps) / FEE_DENOMINATOR;
        uint256 netAmount = amount - fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // $FARM fee → DEAD_ADDRESS (burn); all other tokens → Treasury Vault
        address feeDestination = (token == farmToken) ? DEAD_ADDRESS : address(treasuryVault);

        if (fee > 0) {
            IERC20(token).safeTransfer(feeDestination, fee);
        }

        IERC20(token).safeTransfer(to, netAmount);

        emit TokenTransferRouted(msg.sender, token, to, feeDestination, amount, fee, netAmount);
    }

    // ── FARM → USDT Cashout (SA ADR-01 Option B) ────────────────────────────────

    /**
     * @notice Atomic cashout: swap $FARM for USDT and deduct 1% fee to Treasury in one transaction.
     *         Using a Smart Contract wrapper prevents client-side fee bypass and reduces user
     *         signing steps from 3 (Approve + Swap + Tax) to 2 (Approve FARM to gateway + cashout).
     *
     * @param farmAmount Amount of $FARM tokens to sell.
     * @param minUsdtOut Minimum gross USDT from the swap (2% slippage guard, computed by frontend
     *                   via getAmountsOut × 98%). User receives 99% of actual USDT received.
     */
    function cashoutFarmToUSDT(uint256 farmAmount, uint256 minUsdtOut)
        external
        nonReentrant
    {
        if (farmAmount == 0) revert ZeroAmount();
        // Enforce non-zero slippage protection — caller must always compute a floor via getAmountsOut
        if (minUsdtOut == 0) revert ZeroAmount();

        // 1. Pull FARM from seller into this contract
        IERC20(farmToken).safeTransferFrom(msg.sender, address(this), farmAmount);

        // 2. Approve router to spend FARM (forceApprove resets any stale allowance first)
        IERC20(farmToken).forceApprove(pancakeRouter, farmAmount);

        // 3. Swap FARM → WBNB → USDT via PancakeSwap V2
        //    MUST use SupportingFeeOnTransferTokens because $FARM has dynamic transfer tax.
        //    Route through WBNB because there is no direct FARM/USDT pair.
        address[] memory path = new address[](3);
        path[0] = farmToken;
        path[1] = wbnb;
        path[2] = usdtToken;

        uint256 usdtBefore = IERC20(usdtToken).balanceOf(address(this));

        IPancakeRouterV2(pancakeRouter).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            farmAmount,
            minUsdtOut,
            path,
            address(this),
            block.timestamp + 300
        );

        // 4. Measure actual USDT received (balance delta accounts for FARM's fee-on-transfer)
        uint256 usdtReceived = IERC20(usdtToken).balanceOf(address(this)) - usdtBefore;
        if (usdtReceived == 0) revert ZeroAmount();

        // 5. Deduct 1% cashout fee → Treasury Vault (accumulates for batch USDT→BNB conversion)
        uint256 fee = (usdtReceived * CASHOUT_FEE_BPS) / FEE_DENOMINATOR;
        uint256 netUsdt = usdtReceived - fee;

        if (fee > 0) {
            IERC20(usdtToken).safeTransfer(address(treasuryVault), fee);
        }

        // 6. Return net USDT to seller
        IERC20(usdtToken).safeTransfer(msg.sender, netUsdt);

        emit FarmCashedOut(msg.sender, farmAmount, usdtReceived, fee, netUsdt);
    }

    // ── Configuration & Admin ──────────────────────────────────────────────────

    /**
     * @notice Update P2P transfer fee BPS (capped at MAX_FEE_BPS = 1%).
     */
    function setFeeBps(uint256 _newFeeBps) external onlyOwner {
        if (_newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeBpsUpdated(feeBps, _newFeeBps);
        feeBps = _newFeeBps;
    }

    /**
     * @notice Fallback to accept direct BNB and forward to Treasury.
     */
    receive() external payable {
        if (msg.value > 0) {
            (bool success, ) = treasuryVault.call{value: msg.value}("");
            if (!success) revert TransferFailed();
        }
    }
}

interface IPancakeRouterV2 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}
