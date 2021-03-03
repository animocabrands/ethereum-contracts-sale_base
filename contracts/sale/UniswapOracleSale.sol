// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../oracle/interfaces/IUniswapV2Router.sol";
import "../oracle/UniswapV2Adapter.sol";
import "./abstract/OracleSale.sol";

/**
 * @title UniswapOracleSale
 * An OracleSale which implements a Uniswap-based token conversion pricing strategy. The final
 *  implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a non-zero length array indicates Uniswap-based pricing, otherwise indicates fixed pricing.
 *  - [0] uint256: the token conversion rate used for Uniswap-based pricing.
 */
contract UniswapOracleSale is OracleSale, UniswapV2Adapter {
    using SafeMath for uint256;

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ The payout wallet.
     * @param skusCapacity The cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity The cap for the number of tokens managed per SKU.
     * @param referenceToken The token to use for oracle-based conversions.
     * @param uniswapV2Router The UniswapV2 router contract used to facilitate operations against the Uniswap network.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken,
        IUniswapV2Router uniswapV2Router
    ) public OracleSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity, referenceToken) UniswapV2Adapter(uniswapV2Router) {}

    /*                               Internal Utility Functions                                  */

    /**
     * Retrieves the conversion rate for the `fromToken`/`toToken` pair via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for the pair.
     * @param fromToken The source token from which the conversion rate is derived from.
     * @param toToken the destination token from which the conversion rate is derived from.
     * @param *data* Additional data with no specified format for deriving the conversion rate.
     * @return rate The conversion rate for the `fromToken`/`toToken` pair, retrieved via the oracle.
     */
    function _conversionRate(
        address fromToken,
        address toToken,
        bytes memory /*data*/
    ) internal view virtual override returns (uint256 rate) {
        if (fromToken == TOKEN_ETH) {
            fromToken = uniswapV2Router.WETH();
        }

        if (toToken == TOKEN_ETH) {
            toToken = uniswapV2Router.WETH();
        }

        (uint256 fromReserve, uint256 toReserve) = _getReserves(fromToken, toToken);
        rate = toReserve.mul(10**18).div(fromReserve);
    }
}
