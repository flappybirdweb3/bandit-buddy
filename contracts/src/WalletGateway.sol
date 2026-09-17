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
 *         1. BNB transfers: 0.3% fee is routed to TreasuryBuyBack Vault (0xe59F...) to accumulate
 *            towards the 2.0 BNB auto-buyback threshold.
 *         2. $FARM transfers: 0.3% fee is routed directly to the Black Hole / DEAD address
 *            (0x000000000000000000000000000000000000dEaD) for instant permanent burn!
 *         3. Other tokens (USDT, BUSD): 0.3% fee is routed to the Treasury Vault.
 *
 * Requirements & Specifications:
 *   - PRD: WALLET_FUNCTION_ADDED.MD
 *   - Black Hole / Burn Address: 0x000000000000000000000000000000000000dEaD
 *   - Treasury Vault: 0xe59FfB05EdF59464e8803E81A4d790d828915006
 *   - Fee BPS: 30 BPS (0.3%)
 *   - Safety Ceiling: MAX_FEE_BPS = 100 BPS (1%)
 */
contract WalletGateway is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address payable public immutable treasuryVault;
    address public immutable farmToken;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public feeBps = 30; // 30 BPS = 0.3%
    uint256 public constant MAX_FEE_BPS = 100; // 1% max safety ceiling

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

    error InvalidAddress();
    error ZeroAmount();
    error TransferFailed();
    error FeeTooHigh();

    constructor(
        address payable _treasuryVault,
        address _farmToken,
        address _owner
    ) Ownable(_owner) {
        if (_treasuryVault == address(0) || _farmToken == address(0)) revert InvalidAddress();
        treasuryVault = _treasuryVault;
        farmToken = _farmToken;
    }

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

        // Forward fee to Treasury Buyback Vault
        if (fee > 0) {
            (bool feeSuccess, ) = treasuryVault.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        // Forward net amount to recipient
        (bool recipientSuccess, ) = to.call{value: netAmount}("");
        if (!recipientSuccess) revert TransferFailed();

        emit BNBTransferRouted(msg.sender, to, msg.value, fee, netAmount);
    }

    /**
     * @notice Route ERC-20 token transfer:
     *         - If token is $FARM: 0.3% fee is routed directly to the Black Hole / DEAD address (0x...dEaD) to burn!
     *         - If other token: 0.3% fee is routed to the Treasury Vault.
     * @param token Address of the ERC-20 token.
     * @param to Recipient destination address.
     * @param amount Total amount to transfer.
     */
    function routeTokenTransfer(address token, address to, uint256 amount) external nonReentrant {
        if (token == address(0) || to == address(0) || to == address(this)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 fee = (amount * feeBps) / FEE_DENOMINATOR;
        uint256 netAmount = amount - fee;

        // Pull full amount from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Determine fee destination:
        // $FARM -> DEAD_ADDRESS (Black Hole / Permanent Burn)
        // Other tokens -> Treasury Vault
        address feeDestination = (token == farmToken) ? DEAD_ADDRESS : address(treasuryVault);

        if (fee > 0) {
            IERC20(token).safeTransfer(feeDestination, fee);
        }

        // Forward net amount to recipient
        IERC20(token).safeTransfer(to, netAmount);

        emit TokenTransferRouted(msg.sender, token, to, feeDestination, amount, fee, netAmount);
    }

    /**
     * @notice Update fee BPS (capped at MAX_FEE_BPS = 1%).
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
