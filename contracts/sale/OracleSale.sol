// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./FixedPricesSale.sol";
import "./interfaces/IOracleSale.sol";

/**
 * @title OracleSale
 * A FixedPricesSale which implements an oracle-based pricing strategy. The final implementer is responsible
 *  for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a non-zero length array indicates oracle-based pricing, otherwise indicates fixed pricing.
 *  - [0] uint256: the token exchange rate used for oracle-based pricing.
*/
abstract contract OracleSale is FixedPricesSale, IOracleSale {
    uint256 public constant override PRICE_VIA_ORACLE = type(uint256).max;

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
    )
        internal
        FixedPricesSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity)
    {
        referenceToken = referenceToken_;

        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_VIA_ORACLE", bytes32(PRICE_VIA_ORACLE));
        emit MagicValues(names, values);
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
            purchase.pricingData = new bytes32[](1);
        }
    }
}
