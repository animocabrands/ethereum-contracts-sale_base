// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/PurchaseNotificationsReceiver.sol";

contract PurchaseNotificationsReceiverMock is PurchaseNotificationsReceiver {
    bytes4 public constant PURCHASE_NOTIFICATION_RECEIVED_RESULT =
        bytes4(keccak256("onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])"));

    event PurchaseNotificationReceived();
    event OnPurchaseNotificationReceivedResult(bytes4 result);

    function onPurchaseNotificationReceived(
        address /* purchaser */,
        address /* recipient */,
        address /* token */,
        bytes32 /* sku */,
        uint256 /* quantity */,
        bytes calldata /* userData */,
        uint256 /* totalPrice */,
        bytes32[] calldata /* pricingData */,
        bytes32[] calldata /* paymentData */,
        bytes32[] calldata /* deliveryData */
    ) external override returns (
        bytes4
    ) {
        emit PurchaseNotificationReceived();
        bytes4 result = PURCHASE_NOTIFICATION_RECEIVED_RESULT;
        emit OnPurchaseNotificationReceivedResult(result);
        return result;
    }

}
