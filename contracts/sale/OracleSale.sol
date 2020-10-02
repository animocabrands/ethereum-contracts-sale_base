// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./FixedPricesSale.sol";
import "./interfaces/IOracleSale.sol";

/**
 * @title OracleSale
 * A FixedPricesSale which implements an oracle-based pricing strategy in parallel of top of .
 *  The final implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - [0] uint256: uninterpreted unit price (magic value or fixed price)
 *  - [1] uint256: the conversion rate used for an oracle pricing or 0 for a fixed pricing.
 */
abstract contract OracleSale is FixedPricesSale, IOracleSale {
    uint256 public constant override PRICE_CONVERT_VIA_ORACLE = type(uint256).max;

    address internal _referenceToken;

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
    ) internal FixedPricesSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity) {
        _referenceToken = referenceToken;

        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_CONVERT_VIA_ORACLE", bytes32(PRICE_CONVERT_VIA_ORACLE));
        emit MagicValues(names, values);
    }

    /*                               Public IOracleSale Functions                             */

    /**
     * Returns the token used as reference for oracle-based price conversions.
     * @dev MUST NOT be the zero address.
     * @return the token used as reference for oracle-based price conversions.
     */
    function referenceToken() external virtual override view returns (address) {
        return _referenceToken;
    }

    /**
     * Retrieves the current rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for one of the pairs.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @return rates The rates for the `tokens`/`referenceToken` pairs retrieved via the oracle.
     */
    function conversionRates(address[] calldata tokens)
        external
        virtual
        override
        view
        returns (uint256[] memory rates)
    {
        uint256 length = tokens.length;
        rates = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            rates[i] = _conversionRate(tokens[i], _referenceToken);
        }
    }

    /*                               Internal Utility Functions                               */

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
            tokenPrices.length() == 0 || tokenPrices.contains(bytes32(uint256(_referenceToken))),
            "OracleSale: missing reference token"
        );
    }

    /**
     * Retrieves the conversion rate for the `fromToken`/`toToken` pair via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for the pair.
     * @param fromToken The source token from which the conversion rate is derived from.
     * @param toToken the destination token from which the conversion rate is derived from.
     * @return rate The conversion rate for the `fromToken`/`toToken` pair, retrieved via the oracle.
     */
    function _conversionRate(address fromToken, address toToken) internal virtual view returns (uint256 rate);

    /**
     * Retrieves the unit price of a SKU for the specified payment token.
     * @dev Reverts if the specified payment token is unsupported.
     * @param purchase The purchase conditions specifying the payment token with which the unit price will be retrieved.
     * @param prices Storage pointer to a mapping of SKU token prices to retrieve the unit price from.
     * @return unitPrice The unit price of a SKU for the specified payment token.
     */
    function _unitPrice(PurchaseData memory purchase, EnumMap.Map storage prices)
        internal
        virtual
        override
        view
        returns (uint256 unitPrice)
    {
        unitPrice = super._unitPrice(purchase, prices);
        if (unitPrice == PRICE_CONVERT_VIA_ORACLE) {
            uint256 referenceUnitPrice = uint256(prices.get(bytes32(uint256(_referenceToken))));
            uint256 conversionRate = _conversionRate(purchase.token, _referenceToken);
            unitPrice = referenceUnitPrice.mul(10 ** 18).div(conversionRate);
            purchase.pricingData = new bytes32[](2);
            purchase.pricingData[0] = bytes32(PRICE_CONVERT_VIA_ORACLE);
            purchase.pricingData[1] = bytes32(conversionRate);
        }
    }
}
