// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BanditMarket
 * @notice P2P NFT marketplace for Guard Dog NFTs using EIP-712 off-chain orders.
 *
 * Flow:
 *   1. Seller signs an EIP-712 order off-chain (game server stores it).
 *   2. Buyer calls executeTrade(order, sig) on-chain.
 *   3. Contract verifies sig, transfers NFT seller→buyer, $FARM buyer→seller.
 *   4. Platform fee (2.5%) sent to treasury.
 *
 * Security:
 *   - Nonce-based replay protection (per-seller).
 *   - Deadline enforcement.
 *   - ReentrancyGuard.
 *   - Pause for emergency.
 */
contract BanditMarket is EIP712, ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20  public immutable farmToken;
    address public treasury;
    uint256 public feeBps = 250; // 2.5%

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 priceFarm,uint256 nonce,uint256 deadline)"
    );

    struct Order {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 amount;       // ERC-1155 amount (usually 1)
        uint256 priceFarm;    // in FARM wei
        uint256 nonce;
        uint256 deadline;
    }

    // seller => nonce => used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    event TradeExecuted(
        address indexed seller,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 priceFarm,
        uint256 fee
    );
    event OrderCancelled(address indexed seller, uint256 nonce);
    event FeeUpdated(uint256 newFeeBps);
    event TreasuryUpdated(address newTreasury);

    error OrderExpired();
    error NonceUsed();
    error BadSignature();
    error FeeTooHigh();

    constructor(address _farmToken, address _treasury, address _owner)
        EIP712("BanditMarket", "1")
        Ownable(_owner)
    {
        farmToken = IERC20(_farmToken);
        treasury = _treasury;
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    function executeTrade(Order calldata order, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
    {
        if (block.timestamp > order.deadline) revert OrderExpired();
        if (usedNonces[order.seller][order.nonce]) revert NonceUsed();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.seller,
            order.nftContract,
            order.tokenId,
            order.amount,
            order.priceFarm,
            order.nonce,
            order.deadline
        )));
        address recovered = digest.recover(sig);
        if (recovered != order.seller) revert BadSignature();

        usedNonces[order.seller][order.nonce] = true;

        uint256 fee = (order.priceFarm * feeBps) / 10_000;
        uint256 sellerReceives = order.priceFarm - fee;

        // Transfer $FARM: buyer pays full price
        farmToken.safeTransferFrom(msg.sender, order.seller, sellerReceives);
        if (fee > 0) farmToken.safeTransferFrom(msg.sender, treasury, fee);

        // Transfer NFT: seller must have approved this contract
        IERC1155(order.nftContract).safeTransferFrom(
            order.seller, msg.sender, order.tokenId, order.amount, ""
        );

        emit TradeExecuted(
            order.seller, msg.sender, order.nftContract,
            order.tokenId, order.amount, order.priceFarm, fee
        );
    }

    function cancelOrder(uint256 nonce) external {
        usedNonces[msg.sender][nonce] = true;
        emit OrderCancelled(msg.sender, nonce);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert FeeTooHigh(); // max 10%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── View ─────────────────────────────────────────────────────────────────

    function hashOrder(Order calldata order) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.seller, order.nftContract, order.tokenId,
            order.amount, order.priceFarm, order.nonce, order.deadline
        )));
    }
}
