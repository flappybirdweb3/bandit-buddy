// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockMaliciousRouter
 * @notice Test double for PancakeSwap V2 router to test TreasuryBuyBack.
 */
contract MockMaliciousRouter {
    address public target;
    bytes public attackCalldata;
    address public farmToken;
    uint256 public mockFarmOut;

    function setTarget(address _target) external { target = _target; }
    function setAttackCalldata(bytes calldata _data) external { attackCalldata = _data; }
    function setFarmToken(address _farmToken) external { farmToken = _farmToken; }
    function setMockFarmOut(uint256 _amount) external { mockFarmOut = _amount; }

    function getAmountsOut(uint256 amountIn, address[] calldata)
        external
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = mockFarmOut > 0 ? mockFarmOut : (amountIn * 50_000); // default quote
    }

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

    receive() external payable {}
}