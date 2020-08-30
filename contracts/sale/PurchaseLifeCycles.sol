// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title PurchaseLifeCycles
 * An abstract contract which define the life cycles for a purchase implementer.
 */
abstract contract PurchaseLifeCycles {
    /**
     * Wrapper for the purchase data passed as argument to the life cycle functions and down to their step functions.
     */
    struct PurchaseData {
        address payable purchaser;
        address payable recipient;
        address token;
        bytes32 sku;
        uint256 quantity;
        bytes userData;
        uint256 price;
        bytes32[] pricingData;
        bytes32[] paymentData;
        bytes32[] deliveryData;
    }

    /*                                          Internal Life Cycle Functions                                         */

    /**
     * `estimatePurchase` lifecycle.
     * @param purchase The purchase conditions.
     */
    function _estimatePurchase(PurchaseData memory purchase)
        internal
        virtual
        view
        returns (uint256 price, bytes32[] memory pricingData)
    {
        _validation(purchase);
        _pricing(purchase);

        price = purchase.price;
        pricingData = purchase.pricingData;
    }

    /**
     * `purchaseFor` lifecycle.
     * @param purchase The purchase conditions.
     */
    function _purchaseFor(PurchaseData memory purchase) internal virtual {
        _validation(purchase);
        _pricing(purchase);
        _payment(purchase);
        _delivery(purchase);
        _notification(purchase);
    }

    /*                               Internal Life Cycle Step Functions                               */

    /**
     * Lifecycle step which validates the purchase pre-conditions.
     * @dev Responsibilities:
     *  - Ensure that the purchase pre-conditions are met and revert if not.
     * @param purchase The purchase conditions.
     */
    function _validation(PurchaseData memory purchase) internal virtual view;

    /**
     * Lifecycle step which computes the purchase price.
     * @dev Responsibilities:
     *  - Implement the pricing formula, including any discount logic;
     *  - Set a value for `purchase.price`;
     *  - Add any relevant extra data related to pricing in `purchase.pricingData` and document how to interpret it.
     * @dev Reverts if `purchase.sku` does not exist.
     * @dev Reverts if `purchase.token` is not supported by `purchase.sku`.
     * @dev Reverts in case of price overflow.
     * @param purchase The purchase conditions.
     */
    function _pricing(PurchaseData memory purchase) internal virtual view;

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any price conversion and/or token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(PurchaseData memory purchase) internal virtual;

    /**
     * Lifecycle step which delivers the purchased SKUs to the recipient.
     * @dev Responsibilities:
     *  - Handle any internal logic related to supply update, minting/transferring of the SKU and purchase receipts creation;
     *  - Add any relevant extra data related to delivery in `purchase.deliveryData` and document how to interpret it.
     * @dev Reverts if there is not enough available supply.
     * @param purchase The purchase conditions.
     */
    function _delivery(PurchaseData memory purchase) internal virtual;

    /**
     * Lifecycle step which notifies of the purchase.
     * @dev Responsibilities:
     *  - Manage event(s) emission.
     *  - Ensure calls are made to the notifications receiver contract's `onPurchased` function, if applicable.
     * @dev Reverts if `onPurchased` throws or returns an incorrect value.
     * @dev Emits the `Purchase` event. The values of `purchaseData` are the concatenated values of `priceData`, `paymentData`
     * and `deliveryData`. If not empty, the implementer MUST document how to interpret these values.
     * @param purchase The purchase conditions.
     */
    function _notification(PurchaseData memory purchase) internal virtual;
}
