// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Pair.sol";

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

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'UniswapV2Adapter: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Adapter: ZERO_ADDRESS');
    }

    function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pair = address(uint256(keccak256(abi.encodePacked(
                hex'ff',
                uniswapV2Router.factory(),
                keccak256(abi.encodePacked(token0, token1)),
                hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'
            ))));
    }

    function _getReserves(address tokenA, address tokenB) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0,) = _sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(_pairFor(tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _setUniswapV2Router(IUniswapV2Router uniswapV2Router_) internal {
        uniswapV2Router = uniswapV2Router_;
        emit UniswapV2RouterSet(uniswapV2Router_);
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
