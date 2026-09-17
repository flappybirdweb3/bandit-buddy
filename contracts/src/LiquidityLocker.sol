// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityLocker
/// @notice Locks LP tokens ($FARM/BNB PancakeSwap pair) to prevent rug-pulls.
///         Owner locks tokens; only the designated beneficiary can withdraw after unlock.
contract LiquidityLocker is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct LockRecord {
        address token;       // LP token address (ERC20)
        uint256 amount;      // tokens locked
        uint256 unlockTime;  // block.timestamp + duration
        address beneficiary; // who can withdraw
        bool withdrawn;      // prevents double-withdraw
    }

    uint256 public constant MIN_LOCK_DURATION = 15_552_000; // 6 months in seconds

    LockRecord[] private _locks;

    event TokensLocked(
        uint256 indexed id,
        address indexed token,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    );
    event TokensWithdrawn(uint256 indexed id, uint256 amount);

    error TooShort();
    error NotBeneficiary();
    error NotYet();
    error AlreadyWithdrawn();
    error ZeroAmount();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Lock LP tokens for at least 6 months. Only callable by owner.
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 durationSec,
        address beneficiary
    ) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (durationSec < MIN_LOCK_DURATION) revert TooShort();

        uint256 unlockTime = block.timestamp + durationSec;

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 id = _locks.length;
        _locks.push(LockRecord({
            token: lpToken,
            amount: amount,
            unlockTime: unlockTime,
            beneficiary: beneficiary,
            withdrawn: false
        }));

        emit TokensLocked(id, lpToken, amount, unlockTime, beneficiary);
    }

    /// @notice Withdraw locked tokens after unlock time. Only beneficiary can call.
    function withdraw(uint256 lockId) external nonReentrant {
        LockRecord storage lock = _locks[lockId];

        if (lock.beneficiary != msg.sender) revert NotBeneficiary();
        if (block.timestamp < lock.unlockTime) revert NotYet();
        if (lock.withdrawn) revert AlreadyWithdrawn();

        lock.withdrawn = true;
        uint256 amount = lock.amount;

        IERC20(lock.token).safeTransfer(lock.beneficiary, amount);

        emit TokensWithdrawn(lockId, amount);
    }

    /// @notice Returns the lock record at `id`.
    function getLock(uint256 id) external view returns (LockRecord memory) {
        return _locks[id];
    }

    /// @notice Returns all non-withdrawn (active) locks.
    function getActiveLocks() external view returns (LockRecord[] memory) {
        uint256 total = _locks.length;
        uint256 activeCount;
        for (uint256 i = 0; i < total; i++) {
            if (!_locks[i].withdrawn) activeCount++;
        }

        LockRecord[] memory active = new LockRecord[](activeCount);
        uint256 j;
        for (uint256 i = 0; i < total; i++) {
            if (!_locks[i].withdrawn) {
                active[j] = _locks[i];
                j++;
            }
        }
        return active;
    }

    /// @notice Total number of lock records ever created.
    function lockCount() external view returns (uint256) {
        return _locks.length;
    }
}
