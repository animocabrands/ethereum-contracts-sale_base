// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./FixedPricesSale.sol";
import "./interfaces/IOracleSale.sol";

/**
 * @title OracleSale
 * A FixedPricesSale which implements an oracle-based pricing strategy. The final implementer is responsible
 *  for implementing any additional pricing and/or delivery logic.
 */
abstract contract OracleSale is FixedPricesSale, IOracleSale {
    address public referenceToken;

    /**
     * Constructor.
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
    )
        internal
        FixedPricesSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity)
    {
        referenceToken = referenceToken_;
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
    function _pricing(
        PurchaseData memory purchase
    ) internal virtual override view {
        SkuInfo storage skuInfo = _skuInfos[purchase.sku];
        require(skuInfo.totalSupply != 0, "Sale: unsupported SKU");
        EnumMap.Map storage prices = skuInfo.prices;
        uint256 unitPrice = _unitPrice(purchase, prices);

        if (!_oraclePricing(purchase, prices, unitPrice)) {
            purchase.totalPrice = unitPrice.mul(purchase.quantity);
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
        require(
            tokenPrices.length() == 0 || tokenPrices.contains(bytes32(uint256(referenceToken))),
            "OracleSale: missing reference token"
        );
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
    function _oraclePricing(PurchaseData memory purchase, EnumMap.Map storage tokenPrices, uint256 unitPrice) internal virtual view returns (bool);
}
