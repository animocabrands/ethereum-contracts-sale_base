// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/PurchaseLifeCycles.sol";

contract PurchaseLifeCyclesMock is PurchaseLifeCycles {

    event PurchaseLifeCyclePath(
        uint256 path
    );

    uint256 public constant LIFECYCLE_STEP_VALIDATION = 1 << 1;
    uint256 public constant LIFECYCLE_STEP_PRICING = 1 << 2;
    uint256 public constant LIFECYCLE_STEP_PAYMENT = 1 << 3;
    uint256 public constant LIFECYCLE_STEP_DELIVERY = 1 << 4;
    uint256 public constant LIFECYCLE_STEP_NOTIFICATION = 1 << 5;

    function getEstimatePurchaseLifeCyclePath(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external {
        PurchaseData memory purchaseData = _getPurchaseData(
            recipient,
            token,
            sku,
            quantity,
            userData,
            0,
            new bytes32[](0),
            new bytes32[](0),
            new bytes32[](0));

        _estimatePurchase(purchaseData);

        emit PurchaseLifeCyclePath(purchaseData.totalPrice);
    }

    function getPurchaseForLifeCyclePath(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external {
        PurchaseData memory purchaseData = _getPurchaseData(
            recipient,
            token,
            sku,
            quantity,
            userData,
            0,
            new bytes32[](0),
            new bytes32[](0),
            new bytes32[](0));

        _purchaseFor(purchaseData);

        emit PurchaseLifeCyclePath(purchaseData.totalPrice);
    }

    function _validation(PurchaseData memory purchase) internal override view {
        purchase.totalPrice = purchase.totalPrice | LIFECYCLE_STEP_VALIDATION;
    }

    function _pricing(PurchaseData memory purchase) internal override view {
        purchase.totalPrice = purchase.totalPrice | LIFECYCLE_STEP_PRICING;
    }

    function _payment(PurchaseData memory purchase) internal override {
        purchase.totalPrice = purchase.totalPrice | LIFECYCLE_STEP_PAYMENT;
    }

    function _delivery(PurchaseData memory purchase) internal override {
        purchase.totalPrice = purchase.totalPrice | LIFECYCLE_STEP_DELIVERY;
    }

    function _notification(PurchaseData memory purchase) internal override {
        purchase.totalPrice = purchase.totalPrice | LIFECYCLE_STEP_NOTIFICATION;
    }

    function _getPurchaseData(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes memory userData,
        uint256 totalPrice,
        bytes32[] memory pricingData,
        bytes32[] memory paymentData,
        bytes32[] memory deliveryData
    ) internal view returns (
        PurchaseData memory purchase
    ) {
        purchase.purchaser = msg.sender;
        purchase.recipient = recipient;
        purchase.token = token;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;
        purchase.totalPrice = totalPrice;
        purchase.pricingData = pricingData;
        purchase.paymentData = paymentData;
        purchase.deliveryData = deliveryData;
    }

}
