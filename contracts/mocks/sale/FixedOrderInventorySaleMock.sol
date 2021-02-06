// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/FixedOrderInventorySale.sol";

/**
 * @title FixedOrderInventorySaleMock
 * A FixedPricesSale contract mock implementation that handles the purchase of NFTs of an inventory
 * contract to a receipient. The provisioning of the NFTs occurs in a sequential order defined by a
 * token list. Only a single SKU is supported.
 */
contract FixedOrderInventorySaleMock is FixedOrderInventorySale {

    event DeliveryData(bytes32[] tokens);

    /**
     * Constructor.
     * @dev Reverts if `inventory_` is the zero address.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param inventory_ The IFixedOrderInventoryTransferable contract from which the sale
        inventory NFTs are attributed from.
     * @param payoutWallet The payout wallet.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     */
    constructor(
        address inventory_,
        address payoutWallet,
        uint256 tokensPerSkuCapacity
    )
        public
        FixedOrderInventorySale(
            inventory_,
            payoutWallet,
            tokensPerSkuCapacity)
    {}

    /**
     * Creates an SKU.
     * @dev Reverts if the initial sale supply is empty.
     * @dev Reverts if `sku` already exists.
     * @dev Reverts if `notificationsReceiver` is not the zero address and is not a contract
     *  address.
     * @dev Reverts if the update results in too many SKUs.
     * @dev Emits the `SkuCreation` event.
     * @param sku The SKU identifier.
     * @param maxQuantityPerPurchase The maximum allowed quantity for a single purchase.
     * @param notificationsReceiver The purchase notifications receiver contract address. If
     *  set to the zero address, the notification is not enabled.
     */
    function createSku(
        bytes32 sku,
        uint256 maxQuantityPerPurchase,
        address notificationsReceiver
    ) external {
        _createSku(sku, tokenList.length, maxQuantityPerPurchase, notificationsReceiver);
    }

    /**
     * Retrieves the sale SKU capacity.
     * @return The sale SKU capacity.
     */
    function getSkuCapacity() external view returns (uint256) {
        return _skusCapacity;
    }

    /**
     * Retrieves the sale tokens-per-sku capacity.
     * @return The sale tokens-per-sku capacity.
     */
    function getTokensPerSkuCapacity() external view returns (uint256) {
        return _tokensPerSkuCapacity;
    }

    /**
     * Retrieves the token list.
     * @return The token list.
     */
    function getTokenList() external view returns (uint256[] memory) {
        return tokenList;
    }

    /**
     * Calls the internal `_delivery()` purchase lifecycle function.
     * @dev Emits the DeliveryData event.
     * @param recipient The recipient of the purchase.
     * @param token The token to use as the payment currency.
     * @param sku The identifier of the SKU to purchase.
     * @param quantity The quantity to purchase.
     * @param userData Optional extra user input data.
     * @param totalPrice The amount of `token` paid.
     * @param pricingData Data set by the `_pricing()` purchase lifecycle function.
     * @param paymentData Data set by the `_payment()` puchase lifecycle function.
     */
    function underscoreDelivery(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData,
        uint256 totalPrice,
        bytes32[] calldata pricingData,
        bytes32[] calldata paymentData
    ) external {
        PurchaseData memory purchaseData;

        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;
        purchaseData.totalPrice = totalPrice;
        purchaseData.pricingData = pricingData;
        purchaseData.paymentData = paymentData;

        _delivery(purchaseData);

        emit DeliveryData(purchaseData.deliveryData);
    }

}