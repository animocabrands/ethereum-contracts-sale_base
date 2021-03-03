// Sources flattened with hardhat v2.0.9 https://hardhat.org

// File @openzeppelin/contracts/introspection/IERC165.sol@v3.3.0

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/introspection/ERC165.sol@v3.3.0

pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts may inherit from this and call {_registerInterface} to declare
 * their support of an interface.
 */
abstract contract ERC165 is IERC165 {
    /*
     * bytes4(keccak256('supportsInterface(bytes4)')) == 0x01ffc9a7
     */
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    /**
     * @dev Mapping of interface ids to whether or not it's supported.
     */
    mapping(bytes4 => bool) private _supportedInterfaces;

    constructor () internal {
        // Derived contracts need only register support for their own interfaces,
        // we register support for ERC165 itself here
        _registerInterface(_INTERFACE_ID_ERC165);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     *
     * Time complexity O(1), guaranteed to always use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return _supportedInterfaces[interfaceId];
    }

    /**
     * @dev Registers the contract as an implementer of the interface defined by
     * `interfaceId`. Support of the actual ERC165 interface is automatic and
     * registering its interface id is not required.
     *
     * See {IERC165-supportsInterface}.
     *
     * Requirements:
     *
     * - `interfaceId` cannot be the ERC165 invalid interface (`0xffffffff`).
     */
    function _registerInterface(bytes4 interfaceId) internal virtual {
        require(interfaceId != 0xffffffff, "ERC165: invalid interface id");
        _supportedInterfaces[interfaceId] = true;
    }
}


// File contracts/sale/interfaces/IPurchaseNotificationsReceiver.sol

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
     * @return `bytes4(keccak256(
     *  "onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])"))`
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
    ) external returns (bytes4);
}


// File contracts/sale/abstract/PurchaseNotificationsReceiver.sol

pragma solidity 0.6.8;


/**
 * @title PurchaseNotificationsReceiver
 * Abstract base IPurchaseNotificationsReceiver implementation.
 */
abstract contract PurchaseNotificationsReceiver is IPurchaseNotificationsReceiver, ERC165 {
    bytes4 internal constant _PURCHASE_NOTIFICATION_RECEIVED = type(IPurchaseNotificationsReceiver).interfaceId;
    bytes4 internal constant _PURCHASE_NOTIFICATION_REJECTED = 0xffffffff;

    /**
     * Constructor.
     */
    constructor() internal {
        _registerInterface(_PURCHASE_NOTIFICATION_RECEIVED);
    }
}


// File contracts/mocks/sale/abstract/PurchaseNotificationsReceiverMock.sol

pragma solidity 0.6.8;

contract PurchaseNotificationsReceiverMock is PurchaseNotificationsReceiver {
    bytes4 public constant PURCHASE_NOTIFICATION_RECEIVED_RESULT =
        bytes4(keccak256("onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])"));

    event PurchaseNotificationReceived();
    event OnPurchaseNotificationReceivedResult(bytes4 result);

    function onPurchaseNotificationReceived(
        address, /* purchaser */
        address, /* recipient */
        address, /* token */
        bytes32, /* sku */
        uint256, /* quantity */
        bytes calldata, /* userData */
        uint256, /* totalPrice */
        bytes32[] calldata, /* pricingData */
        bytes32[] calldata, /* paymentData */
        bytes32[] calldata /* deliveryData */
    ) external override returns (bytes4) {
        emit PurchaseNotificationReceived();
        bytes4 result = PURCHASE_NOTIFICATION_RECEIVED_RESULT;
        emit OnPurchaseNotificationReceivedResult(result);
        return result;
    }
}