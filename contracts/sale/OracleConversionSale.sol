// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./OracleSale.sol";
import "./interfaces/IOracleConversionSale.sol";

/**
 * @title OracleConversionSale
 * An OracleSale which implements an oracle-based token conversion pricing strategy. The final implementer is
 *  responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a non-zero length array indicates oracle-based pricing, otherwise indicates fixed pricing.
 *  - [0] uint256: the token conversion rate used for oracle-based pricing.
 */
abstract contract OracleConversionSale is OracleSale, IOracleConversionSale {
    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     * @param skusCapacity the cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     * @param referenceToken the token to use for oracle-based conversions.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken
    )
        internal
        OracleSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken)
    {}

    /*                              Public IOracleConversionSale Functions                             */

    /**
     * Retrieves the token conversion rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for one of the token pairs.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @param data Additional data with no specified format for deriving the conversion rates.
     * @return rates The conversion rates for the `tokens`/`referenceToken` pairs, retrieved via the oracle.
     */
    function conversionRates(
        address[] calldata tokens,
        bytes calldata data
    ) external virtual override view returns (
        uint256[] memory rates
    ) {
        uint256 length = tokens.length;
        rates = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            rates[i] = _conversionRate(tokens[i], referenceToken, data);
        }
    }

    /*                               Internal Utility Functions                                  */

    /**
     * Retrieves the token conversion rate for the `fromToken`/`toToken` pair via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for the pair.
     * @param fromToken The source token from which the conversion rate is derived from.
     * @param toToken the destination token from which the conversion rate is derived from.
     * @param data Additional data with no specified format for deriving the conversion rate.
     * @return rate The conversion rate for the `fromToken`/`toToken` pair, retrieved via the oracle.
     */
    function _conversionRate(address fromToken, address toToken, bytes memory data) internal virtual view returns (uint256 rate);

    /**
     * Retrieves the unit price of a SKU for the specified payment token.
     * @dev Reverts if the specified payment token is unsupported.
     * @param purchase The purchase conditions specifying the payment token with which the unit price will be retrieved.
     * @param prices Storage pointer to a mapping of SKU token prices to retrieve the unit price from.
     * @return unitPrice The unit price of a SKU for the specified payment token.
     */
    function _unitPrice(
        PurchaseData memory purchase,
        EnumMap.Map storage prices
    ) internal virtual override view returns (
        uint256 unitPrice
    ) {
        unitPrice = super._unitPrice(purchase, prices);
        if (unitPrice == PRICE_VIA_ORACLE) {
            uint256 referenceUnitPrice = uint256(prices.get(bytes32(uint256(referenceToken))));
            uint256 conversionRate = _conversionRate(purchase.token, referenceToken, purchase.userData);
            unitPrice = referenceUnitPrice.mul(10 ** 18).div(conversionRate);
            purchase.pricingData[0] = bytes32(conversionRate);
        }
    }
}
