// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FarmToken ($FARM) V2
 * @dev ERC-20 token for Barn Buddy Web3 with holdings-based tiered fee-on-transfer tax.
 *
 * Supply model:
 *   - Fixed cap of 1 billion. All minted to deployer at genesis.
 *   - No additional minting ever – deflationary via burn().
 *
 * Tax model (Option A — Holdings-based, approved by System Architect 2026-09-11):
 *   - Buys/sells against the PancakeSwap pair incur a tax based on the
 *     user's current $FARM balance (balanceOf). SLOAD only — zero SSTORE overhead.
 *   - Tier 1 (hold < tier2Balance):  Buy 3%  / Sell 5%
 *   - Tier 2 (hold < tier3Balance):  Buy 2%  / Sell 3%
 *   - Tier 3 (hold >= tier3Balance): Buy 1%  / Sell 1.5%
 *   - Max tax cap: 5% (500 BPS) — prevents Honeypot flag on TokenSniffer.
 *   - Tax is routed to treasuryBuybackPool for buyback-and-burn.
 *   - Excluded addresses (in-game contracts, treasury) bypass tax entirely.
 */
contract FarmToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint16  public constant MAX_TAX_BPS = 500; // 5% hard cap — audit requirement

    // Tier thresholds based on FARM balance held (not volume)
    uint256 public tier2Balance = 10_000 * 1e18;
    uint256 public tier3Balance = 50_000 * 1e18;

    // Tax rates in basis points (100 = 1%, hard cap = 500 = 5%)
    uint16 public buyTax1  = 300;  // Tier 1 buy
    uint16 public buyTax2  = 200;  // Tier 2 buy
    uint16 public buyTax3  = 100;  // Tier 3 buy
    uint16 public sellTax1 = 500;  // Tier 1 sell
    uint16 public sellTax2 = 300;  // Tier 2 sell
    uint16 public sellTax3 = 150;  // Tier 3 sell

    address public treasuryBuybackPool;
    address public pancakePair; // set after pool creation via setPancakePair()

    mapping(address => bool) public isExcludedFromFee;

    event EmergencyPause(address indexed by);
    event EmergencyUnpause(address indexed by);
    event TaxCollected(address indexed from, address indexed treasury, uint256 taxAmount);
    event PancakePairSet(address pair);
    event TreasurySet(address pool);
    event ExcludedFromFee(address account, bool excluded);

    constructor(address initialOwner)
        ERC20("Farm Token", "FARM")
        ERC20Permit("Farm Token")
        Ownable(initialOwner)
    {
        _mint(initialOwner, MAX_SUPPLY);
        isExcludedFromFee[initialOwner] = true;
        isExcludedFromFee[address(this)] = true;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    function setPancakePair(address pair) external onlyOwner {
        pancakePair = pair;
        emit PancakePairSet(pair);
    }

    function setTreasuryBuybackPool(address pool) external onlyOwner {
        treasuryBuybackPool = pool;
        emit TreasurySet(pool);
    }

    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
        emit ExcludedFromFee(account, excluded);
    }

    /// @notice Set balance thresholds for tier promotion.
    /// @param _tier2 Minimum FARM balance to reach Tier 2 (default 10,000 FARM)
    /// @param _tier3 Minimum FARM balance to reach Tier 3 (default 50,000 FARM)
    function setTierThresholds(uint256 _tier2, uint256 _tier3) external onlyOwner {
        require(_tier2 < _tier3, "FarmToken: tier2 must be < tier3");
        tier2Balance = _tier2;
        tier3Balance = _tier3;
    }

    /// @notice Update tax rates. All values in basis points. Hard cap: 500 BPS (5%).
    function setTaxRates(
        uint16 b1, uint16 b2, uint16 b3,
        uint16 s1, uint16 s2, uint16 s3
    ) external onlyOwner {
        require(
            b1 <= MAX_TAX_BPS && b2 <= MAX_TAX_BPS && b3 <= MAX_TAX_BPS &&
            s1 <= MAX_TAX_BPS && s2 <= MAX_TAX_BPS && s3 <= MAX_TAX_BPS,
            "FarmToken: tax exceeds 5%"
        );
        buyTax1 = b1; buyTax2 = b2; buyTax3 = b3;
        sellTax1 = s1; sellTax2 = s2; sellTax3 = s3;
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /// @notice Returns the tax tier (1, 2, or 3) for a given wallet based on balance.
    function getTierOf(address account) public view returns (uint8) {
        uint256 bal = balanceOf(account);
        if (bal < tier2Balance) return 1;
        if (bal < tier3Balance) return 2;
        return 3;
    }

    // ── Transfer logic ────────────────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        // Skip tax: pair not set, excluded address, or wallet-to-wallet (not a DEX swap)
        if (
            pancakePair == address(0) ||
            isExcludedFromFee[from] ||
            isExcludedFromFee[to] ||
            (from != pancakePair && to != pancakePair)
        ) {
            super._update(from, to, value);
            return;
        }

        bool isBuy = (from == pancakePair);
        address user = isBuy ? to : from;

        // Determine tier from current balance (SLOAD only — Option A, gas-free)
        uint8 tier = getTierOf(user);
        uint16 rate;
        if (tier == 1) {
            rate = isBuy ? buyTax1 : sellTax1;
        } else if (tier == 2) {
            rate = isBuy ? buyTax2 : sellTax2;
        } else {
            rate = isBuy ? buyTax3 : sellTax3;
        }

        uint256 taxAmount = (value * rate) / 10000;

        if (taxAmount > 0) {
            require(treasuryBuybackPool != address(0), "FarmToken: treasury not set");
            super._update(from, treasuryBuybackPool, taxAmount);
            emit TaxCollected(from, treasuryBuybackPool, taxAmount);
        }

        super._update(from, to, value - taxAmount);
    }
}
