// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../FixedPricesSale.sol";
import "../interfaces/IOracleSale.sol";

/**
 * @title OracleSale
 * A FixedPricesSale which implements support for an oracle-based token conversion pricing strategy.
 *  The final implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a zero length array for fixed pricing data.
 *  - a non-zero length array for oracle-based pricing data
 *  - [0] uint256: the uninterpolated unit price (i.e. magic value).
 *  - [1] uint256: the token conversion rate used for oracle-based pricing.
 */
abstract contract OracleSale is IOracleSale, FixedPricesSale {
    uint256 public constant override PRICE_CONVERT_VIA_ORACLE = type(uint256).max;

    address public referenceToken;

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     * @param skusCapacity the cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     * @param referenceToken_ the token to use for oracle-based conversions.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken_
    ) internal FixedPricesSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity) {
        referenceToken = referenceToken_;
        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_CONVERT_VIA_ORACLE", bytes32(PRICE_CONVERT_VIA_ORACLE));
        emit MagicValues(names, values);
    }

    /*                               Internal Life Cycle Functions                               */

    /**
     * Lifecycle step which computes the purchase price.
     * @dev Responsibilities:
     *  - Computes the pricing formula, including any discount logic and price conversion;
     *  - Set the value of `purchase.totalPrice`;
     *  - Add any relevant extra data related to pricing in `purchase.pricingData` and document how to interpret it.
     * @dev Reverts if `purchase.sku` does not exist.
     * @dev Reverts if `purchase.token` is not supported by the SKU.
     * @dev Reverts in case of price overflow.
     * @param purchase The purchase conditions.
     */
    function _pricing(PurchaseData memory purchase) internal view virtual override {
        SkuInfo storage skuInfo = _skuInfos[purchase.sku];
        require(skuInfo.totalSupply != 0, "Sale: unsupported SKU");
        EnumMap.Map storage prices = skuInfo.prices;
        uint256 unitPrice = _unitPrice(purchase, prices);

        if (!_oraclePricing(purchase, prices, unitPrice)) {
            purchase.totalPrice = unitPrice.mul(purchase.quantity);
        }
    }

    /*                              Public IOracleSale Functions                             */

    /**
     * Retrieves the token conversion rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for one of the token pairs.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @param data Additional data with no specified format for deriving the conversion rates.
     * @return rates The conversion rates for the `tokens`/`referenceToken` pairs, retrieved via the oracle.
     */
    function conversionRates(address[] calldata tokens, bytes calldata data) external view virtual override returns (uint256[] memory rates) {
        uint256 length = tokens.length;
        rates = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            rates[i] = _conversionRate(tokens[i], referenceToken, data);
        }
    }

    /*                               Internal Utility Functions                                  */

    /**
     * Updates SKU token prices.
     * @dev Reverts if one of the `tokens` is the zero address.
     * @dev Reverts if the update results in too many tokens for the SKU.
     * @dev Reverts if the SKU has any supported payment tokens and one of them is not the
     *  reference token.
     * @param tokenPrices Storage pointer to a mapping of SKU token prices to update.
     * @param tokens The list of payment tokens to update.
     * @param prices The list of prices to apply for each payment token.
     *  Zero price values are used to disable a payment token.
     */
    function _setTokenPrices(
        EnumMap.Map storage tokenPrices,
        address[] memory tokens,
        uint256[] memory prices
    ) internal virtual override {
        super._setTokenPrices(tokenPrices, tokens, prices);
        // solhint-disable-next-line reason-string
        require(tokenPrices.length() == 0 || tokenPrices.contains(bytes32(uint256(referenceToken))), "OracleSale: missing reference token");
    }

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
    ) internal view virtual returns (bool) {
        if (unitPrice != PRICE_CONVERT_VIA_ORACLE) {
            return false;
        }

        uint256 referenceUnitPrice = uint256(tokenPrices.get(bytes32(uint256(referenceToken))));

        uint256 conversionRate = _conversionRate(purchase.token, referenceToken, purchase.userData);

        uint256 totalPrice = referenceUnitPrice.mul(10**18).div(conversionRate).mul(purchase.quantity);

        purchase.pricingData = new bytes32[](2);
        purchase.pricingData[0] = bytes32(unitPrice);
        purchase.pricingData[1] = bytes32(conversionRate);

        purchase.totalPrice = totalPrice;

        return true;
    }

    /**
     * Retrieves the token conversion rate for the `fromToken`/`toToken` pair via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for the pair.
     * @param fromToken The source token from which the conversion rate is derived from.
     * @param toToken the destination token from which the conversion rate is derived from.
     * @param data Additional data with no specified format for deriving the conversion rate.
     * @return rate The conversion rate for the `fromToken`/`toToken` pair, retrieved via the oracle.
     */
    function _conversionRate(
        address fromToken,
        address toToken,
        bytes memory data
    ) internal view virtual returns (uint256 rate);
}
