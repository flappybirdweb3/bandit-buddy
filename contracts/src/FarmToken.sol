// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FarmToken ($FARM)
 * @dev ERC-20 token for Barn Buddy Web3.
 *
 * Supply model:
 *   - Fixed cap of 1 billion. All minted to deployer at genesis.
 *   - Deployer funds the FarmTokenClaim pool and GuardDogNFT treasury.
 *   - No additional minting ever – deflationary via burn().
 *
 * Security:
 *   - Pausable: owner can halt all transfers in emergency.
 *   - Permit (EIP-2612): gasless approvals for better UX on mobile wallets.
 *   - Burnable: GuardDogNFT burns collected FARM as a supply sink (optional).
 */
contract FarmToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion FARM

    event EmergencyPause(address indexed by);
    event EmergencyUnpause(address indexed by);

    constructor(address initialOwner)
        ERC20("Farm Token", "FARM")
        ERC20Permit("Farm Token")
        Ownable(initialOwner)
    {
        _mint(initialOwner, MAX_SUPPLY);
    }

    function pause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
