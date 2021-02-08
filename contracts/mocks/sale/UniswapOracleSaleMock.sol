// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../oracle/interfaces/IUniswapV2Router.sol";
import "../../sale/UniswapOracleSale.sol";

contract UniswapOracleSaleMock is UniswapOracleSale {

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

    function createSku(
        bytes32 sku,
        uint256 totalSupply,
        uint256 maxQuantityPerPurchase,
        address notificationsReceiver
    ) external {
        _createSku(sku, totalSupply, maxQuantityPerPurchase, notificationsReceiver);
    }

    function callUnderscoreConversionRate(
        address fromToken,
        address toToken,
        bytes calldata data
    ) external view returns (
        uint256 rate
    ) {
        rate = _conversionRate(fromToken, toToken, data);
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

        (reserveA, reserveB) = _getReserves(tokenA, tokenB);
    }

}
