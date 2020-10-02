// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./OracleSale.sol";
import "./interfaces/ISwapSale.sol";

/**
 * @title SwapSale
 * An abstract OracleSale contract that leverages the oracle to perform token swaps of payment tokens to a
 *  reference token to be received by the payout wallet. The final implementer is responsible for
 *  implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - [0] uint256: uninterpreted unit price (magic value or fixed price)
 *  - [1] uint256: the conversion/swap rate used for an oracle pricing or 0 for a fixed pricing.
*/
abstract contract SwapSale is OracleSale, ISwapSale {
    uint256 public constant override PRICE_SWAP_TO_REFERENCE_TOKEN = PRICE_CONVERT_VIA_ORACLE - 1;

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ The payout wallet.
     * @param skusCapacity The cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity The cap for the number of tokens managed per SKU.
     * @param referenceToken The token to use for oracle-based token swaps.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken
    )
        public
        OracleSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
    {
        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_SWAP_TO_REFERENCE_TOKEN", bytes32(PRICE_SWAP_TO_REFERENCE_TOKEN));
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
    function _pricing(PurchaseData memory purchase) internal virtual override view {
        super._pricing(purchase);
        if (purchase.pricingData[0] == bytes32(PRICE_SWAP_TO_REFERENCE_TOKEN)) {
            SkuInfo storage skuInfo = _skuInfos[purchase.sku];
            EnumMap.Map storage prices = skuInfo.prices;
            uint256 referenceUnitPrice = uint256(prices.get(bytes32(uint256(_referenceToken))));
            uint256 referenceTotalPrice = referenceUnitPrice.mul(purchase.quantity);
            uint256 totalPrice = _estimateSwap(purchase.token, _referenceToken, referenceTotalPrice);
            uint256 swapRate = referenceTotalPrice.mul(10 ** 18).div(totalPrice);
            purchase.totalPrice = totalPrice;
            purchase.pricingData[1] = bytes32(swapRate);
        }
    }

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(PurchaseData memory purchase) internal virtual override {
        if (purchase.pricingData[0] == bytes32(PRICE_SWAP_TO_REFERENCE_TOKEN)) {
            if (purchase.token == TOKEN_ETH) {
                require(msg.value >= purchase.totalPrice, "Sale: insufficient ETH provided");
            }

            uint256 swapRate = uint256(purchase.pricingData[1]);
            uint256 referenceTotalPrice = swapRate.mul(purchase.totalPrice).div(10 ** 18);

            _swap(purchase.token, _referenceToken, referenceTotalPrice);

            if (purchase.token == TOKEN_ETH) {
                uint256 change = msg.value.sub(purchase.totalPrice);

                if (change != 0) {
                    purchase.purchaser.transfer(change);
                }
            }
        } else {
            super._payment(purchase);
        }
    }

    /*                               Internal Utility Functions                                  */

    /**
     * Estimates the optimal amount of `fromToken` to provide in order to swap for the specified amount of
     *  `toToken`, via the oracle.
     * @dev Reverts if the oracle cannot estimate the optimal amount of `fromToken` to provide.
     * @param fromToken The source token to swap from.
     * @param toToken The destination token to swap to.
     * @param toAmount The amount of destination tokens to swap for.
     * @return fromAmount The estimated optimal amount of `fromToken` to provide in order to perform a swap
     *  via the oracle.
     */
    function _estimateSwap(address fromToken, address toToken, uint256 toAmount) internal virtual view returns (uint256 fromAmount);

    /**
     * Swaps `fromToken` for the specified amount of `toToken`.
     * @dev Reverts if the oracle is unable to perform the token swap.
     * @param fromToken The source token to swap from.
     * @param toToken The destination token to swap to.
     * @param toAmount The amount of destination tokens to swap for.
     */
    function _swap(address fromToken, address toToken, uint256 toAmount) internal virtual;

    /**
     * Retrieves the unit price of a SKU for the specified payment token.
     * @dev Reverts if the specified payment token is unsupported.
     * @dev Returns a zero if the uninterpreted unit price is the PRICE_SWAP_TO_REFERENCE_TOKEN magic value.
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
        if (unitPrice == PRICE_SWAP_TO_REFERENCE_TOKEN) {
            unitPrice = 0;
            purchase.pricingData = new bytes32[](2);
            purchase.pricingData[0] = bytes32(PRICE_SWAP_TO_REFERENCE_TOKEN);
            purchase.pricingData[1] = 0;
        }
    }
}
