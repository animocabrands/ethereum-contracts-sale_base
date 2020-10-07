// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/PurchaseNotificationsReceiver.sol";

contract PurchaseNotificationsReceiverMock is PurchaseNotificationsReceiver {

    event PurchaseNotificationRecieved();

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
        emit PurchaseNotificationRecieved();
        return bytes4(keccak256("onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])"));
    }

}
