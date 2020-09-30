// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../sale/payment/interfaces/IUniswapV2Router.sol";
import "../../sale/payment/UniswapV2Adapter.sol";
import "../../sale/UniswapOracleSale.sol";

contract UniswapOracleSaleMock is UniswapOracleSale {
    using SafeMath for uint256;

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken,
        IUniswapV2Router uniswapV2Router
    )
        public
        UniswapOracleSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken,
            uniswapV2Router
        )
    {}

    function getConversionRate(
        address fromToken,
        address toToken
    ) external view returns (uint256 rate) {
        rate = _conversionRate(fromToken, toToken);
    }

    function getReserves(
        address tokenA,
        address tokenB
    ) external view returns (
        uint256 reserveA,
        uint256 reserveB
    ) {
        if (tokenA == TOKEN_ETH) {
            tokenA = uniswapV2Router.WETH();
        }

        if (tokenB == TOKEN_ETH) {
            tokenB = uniswapV2Router.WETH();
        }

        (reserveA, reserveB) = UniswapV2Adapter._getReserves(tokenA, tokenB);
    }

}
