// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./OracleSale.sol";
import "./interfaces/IOracleConversionSale.sol";

/**
 * @title OracleConversionSale
 * An OracleSale which implements support for an oracle-based token conversion pricing strategy. The final
 *  implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a zero length array for fixed pricing data.
 *  - a non-zero length array for oracle-based pricing data
 *  - [0] uint256: the uninterpolated unit price (i.e. magic value).
 *  - [1] uint256: the token conversion rate used for oracle-based pricing.
 */
abstract contract OracleConversionSale is OracleSale, IOracleConversionSale {
    uint256 public constant override PRICE_CONVERT_VIA_ORACLE = type(uint256).max;

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
    {
        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_CONVERT_VIA_ORACLE", bytes32(PRICE_CONVERT_VIA_ORACLE));
        emit MagicValues(names, values);
    }

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
     * Computes the oracle-based purchase price.
     * @dev Responsibilities:
     *  - Computes the oracle-based pricing formula, including any discount logic and price conversion;
     *  - Set the value of `purchase.totalPrice`;
     *  - Add any relevant extra data related to pricing in `purchase.pricingData` and document how to interpret it.
     * @dev Reverts in case of price overflow.
     * @param purchase The purchase conditions.
     * @param tokenPrices Storage pointer to a mapping of SKU token prices.
     * @param unitPrice The unit price of a SKU for the specified payment token.
     * @return True if oracle pricing was handled, false otherwise.
     */
    function _oraclePricing(
        PurchaseData memory purchase,
        EnumMap.Map storage tokenPrices,
        uint256 unitPrice
    ) internal virtual override view returns (
        bool
    ) {
        if (unitPrice != PRICE_CONVERT_VIA_ORACLE) {
            return false;
        }

        uint256 referenceUnitPrice = uint256(tokenPrices.get(bytes32(uint256(referenceToken))));

        uint256 conversionRate = _conversionRate(
            purchase.token,
            referenceToken,
            purchase.userData);

        uint256 totalPrice = referenceUnitPrice
            .mul(10 ** 18)
            .div(conversionRate)
            .mul(purchase.quantity);

        purchase.pricingData = new bytes32[](2);
        purchase.pricingData[0] = bytes32(unitPrice);
        purchase.pricingData[1] = bytes32(conversionRate);

        purchase.totalPrice = totalPrice;

        return true;
    }
}
