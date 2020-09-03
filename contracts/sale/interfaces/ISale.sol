// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

/**
 * @title ISale
 *
 * An interface for a contract which allows merchants to display products and customers to purchase them.
 *
 *  Products, designated as SKUs, are represented by bytes32 identifiers so that an identifier can carry an
 *  explicit name under the form of a fixed-length string. Each SKU can be priced via up to several payment
 *  tokens which can be ETH and/or ERC20(s). ETH token is represented by the magic value TOKEN_ETH, which means
 *  this value can be used as the 'token' argument of the purchase-related functions to indicate ETH payment.
 *
 *  The total available supply for a SKU is fixed at its creation. The magic value SUPPLY_UNLIMITED is used
 *  to represent a SKU with an infinite, never-decreasing supply. An optional purchase notifications receiver
 *  contract address can be set for a SKU at its creation: if the value is different from the zero address,
 *  the function `onPurchaseNotificationReceived` will be called on this address upon every purchase of the SKU.
 *
 *  This interface is designed to be consistent while managing a variety of implementation scenarios. It is
 *  also intended to be developer-friendly: all vital information is consistently deductible from the events
 *  (backend-oriented), as well as retrievable through calls to public functions (frontend-oriented).
 */
interface ISale {
    /**
     * Event emitted to notify about the magic values necessary for interfacing with this contract.
     * @param names An array of names for the magic values used by the contract.
     * @param values An array of values for the magic values used by the contract.
     */
    event MagicValues(bytes32[] names, bytes32[] values);

    /**
     * Event emitted to notify about the creation of a SKU.
     * @param sku The identifier of the created SKU.
     * @param totalSupply The initial total supply for sale.
     * @param maxQuantityPerPurchase The maximum allowed quantity for a single purchase.
     * @param notificationsReceiver If not the zero address, the address of a contract on which `onPurchaseNotificationReceived` will be called after each purchase,
     *  If this is the zero address, the call is not enabled.
     */
    event SkuCreation(bytes32 sku, uint256 totalSupply, uint256 maxQuantityPerPurchase, address notificationsReceiver);

    /**
     * Event emitted to notify about a change in the pricing of a SKU.
     * @dev `tokens` and `prices` arrays MUST have the same length.
     * @param sku The identifier of the updated SKU.
     * @param tokens An array of updated payment tokens. If empty, interpret as all payment tokens being disabled.
     * @param prices An array of updated prices for each of the payment tokens.
     *  Zero price values are used for payment tokens being disabled.
     */
    event SkuPricingUpdate(bytes32 indexed sku, address[] tokens, uint256[] prices);

    /**
     * Event emitted to notify about a purchase.
     * @param purchaser The initiater and buyer of the purchase.
     * @param recipient The recipient of the purchase.
     * @param token The token used as the currency for the payment.
     * @param sku The identifier of the purchased SKU.
     * @param quantity The purchased quantity.
     * @param userData Optional extra user input data.
     * @param totalPrice The amount of `token` paid.
     * @param pricingData Implementation-specific extra pricing data, such as details about discounts applied.
     * @param paymentData Implementation-specific extra payment data, such as conversion rates.
     * @param deliveryData Implementation-specific extra delivery data, such as purchase receipts.
     */
    event Purchase(
        address indexed purchaser,
        address recipient,
        address indexed token,
        bytes32 indexed sku,
        uint256 quantity,
        bytes userData,
        uint256 totalPrice,
        bytes32[] pricingData,
        bytes32[] paymentData,
        bytes32[] deliveryData
    );

    /**
     * Returns the magic value used to represent the ETH payment token.
     * @dev MUST NOT be the zero address.
     * @return the magic value used to represent the ETH payment token.
     */
    function TOKEN_ETH() external pure returns (address);

    /**
     * Returns the magic value used to represent an infinite, never-decreasing SKU's supply.
     * @dev MUST NOT be zero.
     * @return the magic value used to represent an infinite, never-decreasing SKU's supply.
     */
    function SUPPLY_UNLIMITED() external pure returns (uint256);

    /**
     * Performs a purchase.
     * @dev Reverts if `token` is the address zero.
     * @dev Reverts if `quantity` is zero.
     * @dev Reverts if `quantity` is greater than the maximum purchase quantity.
     * @dev Reverts if `quantity` is greater than the remaining supply.
     * @dev Reverts if `sku` does not exist.
     * @dev Reverts if `sku` exists but does not have a price set for `token`.
     * @dev Emits the Purchase event.
     * @param recipient The recipient of the purchase.
     * @param token The token to use as the payment currency.
     * @param sku The identifier of the SKU to purchase.
     * @param quantity The quantity to purchase.
     * @param userData Optional extra user input data.
     */
    function purchaseFor(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external payable;

    /**
     * Estimates the computed final total amount to pay for a purchase, including any potential discount.
     * @dev This function MUST compute the same price as `purchaseFor` would in identical conditions (same arguments, same point in time).
     * @dev Reverts if `token` is the zero address.
     * @dev Reverts if `quantity` is zero.
     * @dev Reverts if `quantity` is greater than the maximum purchase quantity.
     * @dev Reverts if `quantity` is greater than the remaining supply.
     * @dev Reverts if `sku` does not exist.
     * @dev Reverts if `sku` exists but does not have a price set for `token`.
     * @param recipient The recipient of the purchase used to calculate the total price amount.
     * @param token The payment token used to calculate the total price amount.
     * @param sku The identifier of the SKU used to calculate the total price amount.
     * @param quantity The quantity used to calculate the total price amount.
     * @param userData Optional extra user input data.
     * @return totalPrice The computed total price to pay.
     * @return pricingData Implementation-specific extra pricing data, such as details about discounts applied.
     *  If not empty, the implementer MUST document how to interepret the values.
     */
    function estimatePurchase(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view returns (uint256 totalPrice, bytes32[] memory pricingData);

    /**
     * Returns the information relative to a SKU.
     * @dev WARNING: it is the responsibility of the implementer to ensure that the
     *  number of payment tokens is bounded, so that this function does not run out of gas.
     * @dev Reverts if `sku` does not exist.
     * @param sku The SKU identifier.
     * @return totalSupply The initial total supply for sale.
     * @return remainingSupply The remaining supply for sale.
     * @return maxQuantityPerPurchase The maximum allowed quantity for a single purchase.
     * @return notificationsReceiver The address of a contract on which to call the `onPurchaseNotificationReceived` function.
     * @return tokens The list of supported payment tokens.
     * @return prices The list of associated prices for each of the `tokens`.
     */
    function getSkuInfo(bytes32 sku)
        external
        view
        returns (
            uint256 totalSupply,
            uint256 remainingSupply,
            uint256 maxQuantityPerPurchase,
            address notificationsReceiver,
            address[] memory tokens,
            uint256[] memory prices
        );

    /**
     * Returns the list of created SKU identifiers.
     * @dev WARNING: it is the responsibility of the implementer to ensure that the
     *  number of SKUs is bounded, so that this function does not run out of gas.
     * @return skus the list of created SKU identifiers.
     */
    function getSkus() external view returns (bytes32[] memory skus);
}
