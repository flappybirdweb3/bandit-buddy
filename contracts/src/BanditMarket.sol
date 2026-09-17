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
 * @title BanditMarket v2
 * @notice P2P marketplace for BanditBuddy. Handles two asset classes:
 *
 *   buyNFT()           — Guard Dog ERC-1155 (on-chain). Contract transfers NFT seller→buyer.
 *   buyOffchainItem()  — Crates / Magnifying Glass / Master Key (DB). Contract only moves $FARM and
 *                        emits OffchainItemSold. Backend Indexer delivers item via user_items.
 *
 * Both paths use EIP-712 off-chain seller signatures and per-seller nonces.
 *
 * Security: ReentrancyGuard · Pausable · EIP-712 replay protection · deadline enforcement.
 */
contract BanditMarket is EIP712, ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20  public immutable farmToken;
    address public treasury;
    uint256 public feeBps = 500; // 5% — adjustable up to 10%
    uint256 public feeBpsBNB = 300; // 3% — platform fee for BNB trades

    // ── EIP-712 type hashes ──────────────────────────────────────────────────

    bytes32 public constant NFT_ORDER_TYPEHASH = keccak256(
        "NFTOrder(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 priceFarm,uint256 nonce,uint256 deadline)"
    );

    bytes32 public constant NFT_ORDER_BNB_TYPEHASH = keccak256(
        "NFTOrderBNB(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 priceBNB,uint256 nonce,uint256 deadline)"
    );

    bytes32 public constant OFFCHAIN_ORDER_TYPEHASH = keccak256(
        "OffchainItemOrder(address seller,string itemType,uint256 quantity,uint256 priceFarm,uint256 nonce,uint256 deadline)"
    );

    // ── Structs ──────────────────────────────────────────────────────────────

    struct NFTOrder {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 amount;      // ERC-1155 amount (usually 1)
        uint256 priceFarm;   // total price in FARM wei
        uint256 nonce;
        uint256 deadline;
    }

    struct NFTOrderBNB {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 amount;      // ERC-1155 amount (usually 1)
        uint256 priceBNB;    // total price in BNB wei
        uint256 nonce;
        uint256 deadline;
    }

    struct OffchainItemOrder {
        address seller;
        string  itemType;    // e.g. "master_key", "crate_wheat"
        uint256 quantity;
        uint256 priceFarm;   // total price in FARM wei
        uint256 nonce;
        uint256 deadline;
    }

    // seller => nonce => used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // ── Events ───────────────────────────────────────────────────────────────

    event NFTOrderFilled(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 priceFarm,
        uint256 fee
    );

    // Backend Indexer listens for this event to deliver off-chain items via user_items DB.
    // itemType + quantity embedded so the worker needs zero extra API calls.
    event OffchainItemSold(
        address indexed buyer,
        address indexed seller,
        string  itemType,
        uint256 quantity,
        uint256 priceFarm,
        uint256 fee,
        uint256 nonce
    );

    event OrderCancelled(address indexed seller, uint256 nonce);
    event FeeUpdated(uint256 newFeeBps);
    event FeeBpsBNBUpdated(uint256 newFeeBpsBNB);
    event TreasuryUpdated(address indexed newTreasury);

    event NFTOrderFilledBNB(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 priceBNB,
        uint256 fee
    );

    // ── Errors ───────────────────────────────────────────────────────────────

    error OrderExpired();
    error NonceUsed();
    error BadSignature();
    error FeeTooHigh();
    error ZeroAddress();
    error IncorrectBNBAmount(uint256 sent, uint256 expected);
    error NativeTransferFailed();

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address _farmToken, address _treasury, address _owner)
        EIP712("BanditMarket", "2")
        Ownable(_owner)
    {
        if (_treasury == address(0)) revert ZeroAddress();
        farmToken = IERC20(_farmToken);
        treasury  = _treasury;
    }

    // ── NFT Trading (Guard Dogs — ERC-1155 on-chain) ─────────────────────────

    /**
     * @notice Buy a Guard Dog NFT. Seller must have called setApprovalForAll on the nftContract.
     * @param order  EIP-712 typed order signed by seller.
     * @param sig    Seller's EIP-712 signature.
     */
    function buyNFT(NFTOrder calldata order, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
    {
        _validateNonce(order.seller, order.nonce, order.deadline);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            NFT_ORDER_TYPEHASH,
            order.seller,
            order.nftContract,
            order.tokenId,
            order.amount,
            order.priceFarm,
            order.nonce,
            order.deadline
        )));
        if (digest.recover(sig) != order.seller) revert BadSignature();

        usedNonces[order.seller][order.nonce] = true;

        (uint256 fee, uint256 sellerReceives) = _splitFee(order.priceFarm);
        farmToken.safeTransferFrom(msg.sender, order.seller, sellerReceives);
        if (fee > 0) farmToken.safeTransferFrom(msg.sender, treasury, fee);

        IERC1155(order.nftContract).safeTransferFrom(
            order.seller, msg.sender, order.tokenId, order.amount, ""
        );

        emit NFTOrderFilled(
            msg.sender, order.seller, order.nftContract,
            order.tokenId, order.amount, order.priceFarm, fee
        );
    }

    /**
     * @notice Buy a Guard Dog NFT with native BNB.
     *         Platform collects 3% platform fee and routes directly to TreasuryBuyBack vault.
     *         Remaining 97% goes directly to the seller.
     * @param order  EIP-712 typed BNB order signed by seller.
     * @param sig    Seller's EIP-712 signature.
     */
    function buyNFTWithBNB(NFTOrderBNB calldata order, bytes calldata sig)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value != order.priceBNB || order.priceBNB == 0) {
            revert IncorrectBNBAmount(msg.value, order.priceBNB);
        }
        _validateNonce(order.seller, order.nonce, order.deadline);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            NFT_ORDER_BNB_TYPEHASH,
            order.seller,
            order.nftContract,
            order.tokenId,
            order.amount,
            order.priceBNB,
            order.nonce,
            order.deadline
        )));
        if (digest.recover(sig) != order.seller) revert BadSignature();

        usedNonces[order.seller][order.nonce] = true;

        uint256 fee = (order.priceBNB * feeBpsBNB) / 10_000;
        uint256 sellerReceives = order.priceBNB - fee;

        // 1. Send 97% BNB to seller
        (bool s1, ) = order.seller.call{value: sellerReceives}("");
        if (!s1) revert NativeTransferFailed();

        // 2. Send 3% BNB platform fee directly to TreasuryBuyBack vault
        if (fee > 0) {
            (bool s2, ) = treasury.call{value: fee}("");
            if (!s2) revert NativeTransferFailed();
        }

        // 3. Transfer NFT from seller to buyer
        IERC1155(order.nftContract).safeTransferFrom(
            order.seller, msg.sender, order.tokenId, order.amount, ""
        );

        emit NFTOrderFilledBNB(
            msg.sender, order.seller, order.nftContract,
            order.tokenId, order.amount, order.priceBNB, fee
        );
    }

    // ── Off-chain Item Trading (Crates / Magnifying Glass / Master Key) ─────

    /**
     * @notice Buy an off-chain item (Crate, Magnifying Glass, Master Key).
     *         Contract only moves $FARM and emits OffchainItemSold.
     *         Backend Indexer catches the event and writes to user_items DB.
     * @param order  EIP-712 typed order signed by seller.
     * @param sig    Seller's EIP-712 signature.
     */
    function buyOffchainItem(OffchainItemOrder calldata order, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
    {
        _validateNonce(order.seller, order.nonce, order.deadline);

        // strings are encoded as keccak256(bytes(str)) in EIP-712 structs
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            OFFCHAIN_ORDER_TYPEHASH,
            order.seller,
            keccak256(bytes(order.itemType)),
            order.quantity,
            order.priceFarm,
            order.nonce,
            order.deadline
        )));
        if (digest.recover(sig) != order.seller) revert BadSignature();

        usedNonces[order.seller][order.nonce] = true;

        (uint256 fee, uint256 sellerReceives) = _splitFee(order.priceFarm);
        farmToken.safeTransferFrom(msg.sender, order.seller, sellerReceives);
        if (fee > 0) farmToken.safeTransferFrom(msg.sender, treasury, fee);

        // No on-chain asset transfer. Event is the delivery signal for the backend.
        emit OffchainItemSold(
            msg.sender, order.seller,
            order.itemType, order.quantity,
            order.priceFarm, fee, order.nonce
        );
    }

    /**
     * @notice Seller cancels an order by burning its nonce.
     */
    function cancelOrder(uint256 nonce) external {
        usedNonces[msg.sender][nonce] = true;
        emit OrderCancelled(msg.sender, nonce);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _validateNonce(address seller, uint256 nonce, uint256 deadline) internal view {
        if (block.timestamp > deadline) revert OrderExpired();
        if (usedNonces[seller][nonce])  revert NonceUsed();
    }

    function _splitFee(uint256 price) internal view returns (uint256 fee, uint256 sellerReceives) {
        fee = (price * feeBps) / 10_000;
        sellerReceives = price - fee;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert FeeTooHigh(); // max 10%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeBpsBNB(uint256 _feeBpsBNB) external onlyOwner {
        if (_feeBpsBNB > 1000) revert FeeTooHigh(); // max 10%
        feeBpsBNB = _feeBpsBNB;
        emit FeeBpsBNBUpdated(_feeBpsBNB);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── View ──────────────────────────────────────────────────────────────────

    function hashNFTOrder(NFTOrder calldata order) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            NFT_ORDER_TYPEHASH,
            order.seller, order.nftContract, order.tokenId,
            order.amount, order.priceFarm, order.nonce, order.deadline
        )));
    }

    function hashNFTOrderBNB(NFTOrderBNB calldata order) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            NFT_ORDER_BNB_TYPEHASH,
            order.seller, order.nftContract, order.tokenId,
            order.amount, order.priceBNB, order.nonce, order.deadline
        )));
    }

    function hashOffchainOrder(OffchainItemOrder calldata order) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            OFFCHAIN_ORDER_TYPEHASH,
            order.seller,
            keccak256(bytes(order.itemType)),
            order.quantity,
            order.priceFarm,
            order.nonce,
            order.deadline
        )));
    }
}
