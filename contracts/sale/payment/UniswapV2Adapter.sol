// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IUniswapV2Router.sol";

/**
 * @title UniswapV2Adapter
 * Contract which helps to interact with UniswapV2 router.
 */
contract UniswapV2Adapter {
    using SafeMath for uint256;

    event UniswapV2RouterSet(IUniswapV2Router uniswapV2Router);

    IUniswapV2Router public uniswapV2Router;

    constructor(IUniswapV2Router uniswapV2Router_) public {
        _setUniswapV2Router(uniswapV2Router_);
    }

    function _setUniswapV2Router(IUniswapV2Router uniswapV2Router_) internal {
        uniswapV2Router = uniswapV2Router_;
        emit UniswapV2RouterSet(uniswapV2Router_);
    }

    function _conversionRate(address tokenA, address tokenB) internal view returns (uint256 rate) {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        uint256[] memory rates = uniswapV2Router.getAmountsIn(1, path); // TODO confirm
        rate = rates[0];
    }

    function _swap(
        address tokenA,
        address tokenB,
        uint256 amountInTokenA,
        address to
    ) internal returns (uint256 amount) {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        uint256[] memory amounts = uniswapV2Router.swapTokensForExactTokens(
            amountInTokenA,
            type(uint256).max,
            path,
            to,
            type(uint256).max
        );
        amount = amounts[0];
    }
}
