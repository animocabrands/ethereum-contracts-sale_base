// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/introspection/ERC165.sol";
import "./interfaces/IPurchaseNotificationsReceiver.sol";

/**
 * @title PurchaseNotificationsReceiver
 * Abstract base IPurchaseNotificationsReceiver implementation.
 */
abstract contract PurchaseNotificationsReceiver is IPurchaseNotificationsReceiver, ERC165 {
    bytes4 internal constant _PURCHASE_NOTIFICATION_RECEIVED = type(IPurchaseNotificationsReceiver).interfaceId;
    bytes4 internal constant _PURCHASE_NOTIFICATION_REJECTED = 0xffffffff;

    constructor() internal {
        _registerInterface(type(IPurchaseNotificationsReceiver).interfaceId);
    }
}
