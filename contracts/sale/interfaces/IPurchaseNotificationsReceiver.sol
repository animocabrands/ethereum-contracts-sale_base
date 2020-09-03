// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IPurchaseNotificationsReceiver
 * Interface for any contract that wants to support purchase notifications from a Sale contract.
 */
interface IPurchaseNotificationsReceiver {

    /**
     * Handles the receipt of a purchase notification.
     * @dev This function MUST return the function selector, otherwise the caller will revert the transaction.
     *  The selector to be returned can be obtained as `this.onPurchaseNotificationReceived.selector`
     * @dev This function MAY throw.
     * @param purchaser The purchaser of the purchase.
     * @param recipient The recipient of the purchase.
     * @param token The token to use as the payment currency.
     * @param sku The identifier of the SKU to purchase.
     * @param quantity The quantity to purchase.
     * @param userData Optional extra user input data.
     * @param totalPrice The total price paid.
     * @param pricingData Implementation-specific extra pricing data, such as details about discounts applied.
     * @param paymentData Implementation-specific extra payment data, such as conversion rates.
     * @param deliveryData Implementation-specific extra delivery data, such as purchase receipts.
     * @return `bytes4(keccak256("onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])"))`
     */
    function onPurchaseNotificationReceived(
        address purchaser,
        address recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData,
        uint256 totalPrice,
        bytes32[] calldata pricingData,
        bytes32[] calldata paymentData,
        bytes32[] calldata deliveryData
    ) external pure returns (bytes4);
}
