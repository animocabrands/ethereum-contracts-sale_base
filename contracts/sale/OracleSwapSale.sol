// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "./OracleConvertSale.sol";
import "./interfaces/IOracleSwapSale.sol";

/**
 * @title OracleSwapSale
 * An OracleConvertSale which implements support for an oracle-based token swap pricing strategy. The
 *  final implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a zero length array for fixed pricing data.
 *  - a non-zero length array for oracle-based pricing data
 *  - [0] uint256: the uninterpolated unit price (i.e. magic value).
 *  - [1] uint256: the token conversion/swap rate used for oracle-based pricing.
 *
 * PurchaseData.paymentData:
 *  - [0] uint256: the actual payment price in terms of the purchase token.
 */
abstract contract OracleSwapSale is OracleConvertSale, IOracleSwapSale {
    uint256 public constant override PRICE_SWAP_VIA_ORACLE = PRICE_CONVERT_VIA_ORACLE - 1;

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
        internal
        OracleConvertSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken)
    {
        bytes32[] memory names = new bytes32[](1);
        bytes32[] memory values = new bytes32[](1);
        (names[0], values[0]) = ("PRICE_SWAP_VIA_ORACLE", bytes32(PRICE_SWAP_VIA_ORACLE));
        emit MagicValues(names, values);
    }

    /*                            Public IOracleSwapSale Functions                               */

    /**
     * Retrieves the token swap rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a swap rate for one of the token pairs.
     * @param tokens The list of tokens to retrieve the swap rates for.
     * @param referenceAmount The amount of `referenceToken` to retrieve the swap rates for.
     * @param data Additional data with no specified format for deriving the swap rates.
     * @return rates The swap rates for the `tokens`/`referenceToken` pairs, retrieved via the oracle.
     */
    function swapRates(
        address[] calldata tokens,
        uint256 referenceAmount,
        bytes calldata data
    ) external virtual override view returns (
        uint256[] memory rates
    ) {
        uint256 length = tokens.length;
        rates = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            uint256 tokenAmount = _estimateSwap(tokens[i], referenceToken, referenceAmount, data);
            rates[i] = referenceAmount.mul(10 ** 18).div(tokenAmount);
        }
    }

    /*                               Internal Life Cycle Functions                               */

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(
        PurchaseData memory purchase
    ) internal virtual override {
        if ((purchase.pricingData.length == 0) ||
            (uint256(purchase.pricingData[0]) != PRICE_SWAP_VIA_ORACLE)) {
            super._payment(purchase);
            return;
        }

        if (purchase.token == TOKEN_ETH) {
            require(
                msg.value >= purchase.totalPrice,
                "OracleSwapSale: insufficient ETH provided");
        } else {
            require(
                IERC20(purchase.token).transferFrom(_msgSender(), address(this), purchase.totalPrice),
                "OracleSwapSale: ERC20 payment failed");
        }

        uint256 swapRate = uint256(purchase.pricingData[1]);
        uint256 referenceTotalPrice = swapRate.mul(purchase.totalPrice).div(10 ** 18);

        uint256 fromAmount = _swap(
            purchase.token,
            referenceToken,
            referenceTotalPrice,
            purchase.userData);

        if (purchase.token == TOKEN_ETH) {
            uint256 change = msg.value.sub(fromAmount);

            if (change != 0) {
                purchase.purchaser.transfer(change);
            }
        } else {
            uint256 change = purchase.totalPrice.sub(fromAmount);

            if (change != 0) {
                require(
                    IERC20(purchase.token).transfer(purchase.purchaser, change),
                    "OracleSwapSale: ERC20 payment change failed");
            }
        }

        if (referenceToken == TOKEN_ETH) {
            payoutWallet.transfer(fromAmount);
        } else {
            require(
                IERC20(referenceToken).transfer(payoutWallet, fromAmount),
                "OracleSwapSale: ERC20 payout failed");
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
     * @param data Additional data with no specified format for deriving the swap estimate.
     * @return fromAmount The estimated optimal amount of `fromToken` to provide in order to perform a swap,
     *  via the oracle.
     */
    function _estimateSwap(address fromToken, address toToken, uint256 toAmount, bytes memory data) internal virtual view returns (uint256 fromAmount);

    /**
     * Swaps `fromToken` for the specified amount of `toToken`, via the oracle.
     * @dev Reverts if the oracle is unable to perform the token swap.
     * @param fromToken The source token to swap from.
     * @param toToken The destination token to swap to.
     * @param toAmount The amount of destination tokens to swap for.
     * @param data Additional data with no specified format for performing the swap.
     * return fromAmount The amount of `fromToken` swapped for the specified amount of `toToken`, via the
     *  oracle.
     */
    function _swap(address fromToken, address toToken, uint256 toAmount, bytes memory data) internal virtual returns (uint256 fromAmount);

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
        if (unitPrice != PRICE_SWAP_VIA_ORACLE) {
            return super._oraclePricing(purchase, tokenPrices, unitPrice);
        }

        uint256 referenceUnitPrice = uint256(tokenPrices.get(bytes32(uint256(referenceToken))));
        uint256 referenceTotalPrice = referenceUnitPrice.mul(purchase.quantity);

        uint256 totalPrice = _estimateSwap(
            purchase.token,
            referenceToken,
            referenceTotalPrice,
            purchase.userData);

        uint256 swapRate = referenceTotalPrice.mul(10 ** 18).div(totalPrice);

        purchase.pricingData = new bytes32[](2);
        purchase.pricingData[0] = bytes32(unitPrice);
        purchase.pricingData[1] = bytes32(swapRate);

        purchase.totalPrice = totalPrice;

        return true;
    }
}
