// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BarnServices
 * @notice In-App BNB Revenue Engine for Barn Buddy.
 *         Collects BNB subscriptions (Butler Auto-harvest, Crop Insurance, VIP status).
 *         Instantly routes 100% of received BNB to the TreasuryBuyBack vault to trigger
 *         deflationary auto-buyback and burn of $FARM tokens when the 2.0 BNB threshold is reached.
 */
contract BarnServices is Ownable, ReentrancyGuard, Pausable {
    address public treasury;

    // SubTypes:
    // 1: 7-Day Butler Auto-Harvest & Crop Insurance (0.005 BNB)
    // 2: 30-Day Butler Auto-Harvest & Crop Insurance (0.015 BNB)
    mapping(uint8 => uint256) public subscriptionPrices;
    mapping(uint8 => uint256) public subscriptionDurations;

    // Active subscription expiry per user and subType
    mapping(address => mapping(uint8 => uint256)) public userSubscriptionExpiry;

    event SubscriptionPurchased(
        address indexed user,
        uint8 indexed subType,
        uint256 expiry,
        uint256 bnbPaid
    );
    event TreasuryUpdated(address indexed newTreasury);
    event SubscriptionConfigUpdated(uint8 indexed subType, uint256 price, uint256 duration);

    error ZeroAddress();
    error InvalidSubType();
    error InsufficientBnb(uint256 sent, uint256 required);
    error TreasuryTransferFailed();

    constructor(address _treasury, address _owner) Ownable(_owner) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;

        // Default configurations
        subscriptionPrices[1] = 0.005 ether; // 7 days: 0.005 BNB
        subscriptionDurations[1] = 7 days;

        subscriptionPrices[2] = 0.015 ether; // 30 days: 0.015 BNB
        subscriptionDurations[2] = 30 days;
    }

    /**
     * @notice Purchase or extend a premium subscription with native BNB.
     * @param subType 1 for 7 Days, 2 for 30 Days.
     */
    function purchasePremiumSubscription(uint8 subType)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        uint256 requiredPrice = subscriptionPrices[subType];
        if (requiredPrice == 0) revert InvalidSubType();
        if (msg.value < requiredPrice) revert InsufficientBnb(msg.value, requiredPrice);

        // 1. Immediately forward all BNB to TreasuryBuyBack vault
        (bool success, ) = treasury.call{value: msg.value}("");
        if (!success) revert TreasuryTransferFailed();

        // 2. Extend subscription timestamp (stacks if currently active)
        uint256 currentExpiry = userSubscriptionExpiry[msg.sender][subType];
        uint256 duration = subscriptionDurations[subType];
        uint256 newExpiry = (currentExpiry > block.timestamp ? currentExpiry : block.timestamp) + duration;
        userSubscriptionExpiry[msg.sender][subType] = newExpiry;

        emit SubscriptionPurchased(msg.sender, subType, newExpiry, msg.value);
    }

    // ── Admin Setters ────────────────────────────────────────────────────────

    function setSubscriptionConfig(uint8 subType, uint256 price, uint256 duration) external onlyOwner {
        if (subType == 0) revert InvalidSubType();
        subscriptionPrices[subType] = price;
        subscriptionDurations[subType] = duration;
        emit SubscriptionConfigUpdated(subType, price, duration);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── View Helpers ─────────────────────────────────────────────────────────

    function getSubscriptionExpiry(address user, uint8 subType) external view returns (uint256) {
        return userSubscriptionExpiry[user][subType];
    }

    function isSubscriptionActive(address user, uint8 subType) external view returns (bool) {
        return userSubscriptionExpiry[user][subType] > block.timestamp;
    }
}
