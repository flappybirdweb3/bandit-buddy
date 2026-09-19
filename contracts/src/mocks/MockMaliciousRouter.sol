// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockMaliciousRouter
 * @notice Test double for PancakeSwap V2 router — covers all swap variants used by
 *         TreasuryBuyBack and WalletGateway so unit tests can exercise full swap paths
 *         without a forked mainnet:
 *           • BNB  → FARM  via swapExactETHForTokensSupportingFeeOnTransferTokens
 *           • FARM → USDT  via swapExactTokensForTokensSupportingFeeOnTransferTokens
 *           • USDT → BNB   via swapExactTokensForETH
 */
contract MockMaliciousRouter {
    address public target;
    bytes public attackCalldata;

    // BNB→FARM (buyback path)
    address public farmToken;
    uint256 public mockFarmOut;

    // FARM→USDT (cashout path)
    address public usdtToken;
    uint256 public mockUsdtOut;

    // USDT→BNB (conversion path)
    uint256 public mockBnbOut;

    function setTarget(address _target) external { target = _target; }
    function setAttackCalldata(bytes calldata _data) external { attackCalldata = _data; }
    function setFarmToken(address _farmToken) external { farmToken = _farmToken; }
    function setMockFarmOut(uint256 _amount) external { mockFarmOut = _amount; }
    function setUsdtToken(address _usdt) external { usdtToken = _usdt; }
    function setMockUsdtOut(uint256 _amount) external { mockUsdtOut = _amount; }
    function setMockBnbOut(uint256 _amount) external { mockBnbOut = _amount; }

    // ── Quotes ────────────────────────────────────────────────────────────────

    function getAmountsOut(uint256 amountIn, address[] calldata)
        external
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = mockFarmOut > 0 ? mockFarmOut : (amountIn * 50_000);
    }

    // ── BNB → FARM (buyback) ─────────────────────────────────────────────────

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256,
        address[] calldata,
        address to,
        uint256
    ) external payable {
        if (attackCalldata.length > 0) {
            (bool ok, bytes memory ret) = target.call(attackCalldata);
            if (!ok) {
                assembly { revert(add(ret, 0x20), mload(ret)) }
            }
        }
        if (farmToken != address(0) && mockFarmOut > 0) {
            IERC20(farmToken).transfer(to, mockFarmOut);
        }
    }

    function swapExactETHForTokens(
        uint256,
        address[] calldata,
        address to,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        if (attackCalldata.length > 0) {
            (bool ok, bytes memory ret) = target.call(attackCalldata);
            if (!ok) {
                assembly { revert(add(ret, 0x20), mload(ret)) }
            }
        }
        if (farmToken != address(0) && mockFarmOut > 0) {
            IERC20(farmToken).transfer(to, mockFarmOut);
        }
        amounts = new uint256[](2);
        amounts[0] = msg.value;
        amounts[1] = mockFarmOut;
    }

    // ── FARM → USDT (cashout) ────────────────────────────────────────────────
    // WalletGateway pulls FARM into itself, approves router, then calls this.
    // The mock pulls FARM from msg.sender and delivers mockUsdtOut USDT to `to`.

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        if (usdtToken != address(0) && mockUsdtOut > 0) {
            IERC20(usdtToken).transfer(to, mockUsdtOut);
        }
    }

    // ── USDT → BNB (conversion) ──────────────────────────────────────────────
    // TreasuryBuyBack approves router, then calls this.
    // The mock pulls USDT from msg.sender and sends mockBnbOut BNB to `to`.

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        if (mockBnbOut > 0) {
            (bool ok,) = payable(to).call{value: mockBnbOut}("");
            require(ok, "MockRouter: BNB transfer failed");
        }
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = mockBnbOut;
    }

    receive() external payable {}
}