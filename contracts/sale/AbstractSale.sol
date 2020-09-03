// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-core_library/contracts/algo/EnumMap.sol";
import "@animoca/ethereum-contracts-core_library/contracts/algo/EnumSet.sol";
import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/Startable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/ISale.sol";
import "./interfaces/IPurchaseNotificationsReceiver.sol";
import "./PurchaseLifeCycles.sol";

/**
 * @title AbstractSale
 * An abstract base sale contract with a minimal implementation of ISale and administration functions.
 *  A minimal implementation of the `_validation`, `_delivery` and `notification` life cycle step functions
 *  are provided, but the inheriting contract must implement `_pricing` and `_payment`.
 */
abstract contract AbstractSale is PurchaseLifeCycles, ISale, PayoutWallet, Startable, Pausable {
    using Address for address;
    using SafeMath for uint256;
    using EnumSet for EnumSet.Set;
    using EnumMap for EnumMap.Map;

    struct SkuInfo {
        uint256 totalSupply;
        uint256 remainingSupply;
        uint256 maxQuantityPerPurchase;
        address notificationsReceiver;
        EnumMap.Map prices;
    }

    address public constant override TOKEN_ETH = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    uint256 public constant override SUPPLY_UNLIMITED = type(uint256).max;

    EnumSet.Set internal _skus;
    mapping(bytes32 => SkuInfo) internal _skuInfos;

    uint256 internal immutable _skusCapacity;
    uint256 internal immutable _tokensPerSkuCapacity;

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     * @param skusCapacity the cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity
    ) internal PayoutWallet(payoutWallet_) {
        _skusCapacity = skusCapacity;
        _tokensPerSkuCapacity = tokensPerSkuCapacity;
        bytes32[] memory names = new bytes32[](2);
        bytes32[] memory values = new bytes32[](2);
        (names[0], values[0]) = ("TOKEN_ETH", bytes32(uint256(TOKEN_ETH)));
        (names[1], values[1]) = ("SUPPLY_UNLIMITED", bytes32(uint256(SUPPLY_UNLIMITED)));
        emit MagicValues(names, values);
        _pause();
    }

    /*                               Public Admin Functions                               */

    /**
     * Actvates, or 'starts', the contract.
     * @dev Emits the `Started` event.
     * @dev Emits the `Unpaused` event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the contract has already been started.
     * @dev Reverts if the contract is not paused.
     */
    function start() public virtual onlyOwner {
        _start();
        _unpause();
    }

    /**
     * Pauses the contract.
     * @dev Emits the `Paused` event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the contract has not been started yet.
     * @dev Reverts if the contract is already paused.
     */
    function pause() public virtual onlyOwner whenStarted {
        _pause();
    }

    /**
     * Resumes the contract.
     * @dev Emits the `Unpaused` event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the contract has not been started yet.
     * @dev Reverts if the contract is not paused.
     */
    function unpause() public virtual onlyOwner whenStarted {
        _unpause();
    }

    /**
     * Creates an SKU.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if `totalSupply` is zero.
     * @dev Reverts if `sku` already exists.
     * @dev Reverts if `notificationsReceiver` is not the zero address and is not a contract address.
     * @dev Reverts if the update results in too many SKUs.
     * @dev Emits the `SkuCreation` event.
     * @param sku the SKU identifier.
     * @param totalSupply the initial total supply.
     * @param maxQuantityPerPurchase The maximum allowed quantity for a single purchase.
     * @param notificationsReceiver The purchase notifications receiver contract address.
     *  If set to the zero address, the notification is not enabled.
     */
    function createSku(
        bytes32 sku,
        uint256 totalSupply,
        uint256 maxQuantityPerPurchase,
        address notificationsReceiver
    ) public virtual onlyOwner {
        require(totalSupply != 0, "Sale: zero supply");
        require(_skus.length() < _skusCapacity, "Sale: too many skus");
        require(_skus.add(sku), "Sale: sku already created");
        if (notificationsReceiver != address(0)) {
            require(notificationsReceiver.isContract(), "Sale: receiver is not a contract");
        }
        SkuInfo storage skuInfo = _skuInfos[sku];
        skuInfo.totalSupply = totalSupply;
        skuInfo.remainingSupply = totalSupply;
        skuInfo.maxQuantityPerPurchase = maxQuantityPerPurchase;
        skuInfo.notificationsReceiver = notificationsReceiver;
        emit SkuCreation(sku, totalSupply, maxQuantityPerPurchase, notificationsReceiver);
    }

    /**
     * Sets the token prices for the specified product SKU.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if `tokens` and `prices` have different lengths.
     * @dev Reverts if `sku` does not exist.
     * @dev Reverts if one of the `tokens` is the zero address.
     * @dev Reverts if the update results in too many tokens for the SKU.
     * @dev Emits the `SkuPricingUpdate` event.
     * @param sku The identifier of the SKU.
     * @param tokens The list of payment tokens to update.
     *  If empty, disable all the existing payment tokens.
     * @param prices The list of prices to apply for each payment token.
     *  Zero price values are used to disable a payment token.
     */
    function updateSkuPricing(
        bytes32 sku,
        address[] memory tokens,
        uint256[] memory prices
    ) public virtual onlyOwner {
        uint256 length = tokens.length;
        require(length == prices.length, "Sale: tokens/prices lengths mismatch");
        SkuInfo storage skuInfo = _skuInfos[sku];
        require(skuInfo.totalSupply != 0, "Sale: non-existent sku");

        EnumMap.Map storage tokenPrices = skuInfo.prices;
        if (length == 0) {
            uint256 currentLength = tokenPrices.length();
            for (uint256 i = 0; i < currentLength; ++i) {
                // TODO add a clear function in EnumMap and EnumSet and use it
                (bytes32 token, ) = tokenPrices.at(0);
                tokenPrices.remove(token);
            }
        } else {
            _setTokenPrices(tokenPrices, tokens, prices);
        }

        emit SkuPricingUpdate(sku, tokens, prices);
    }

    /*                               ISale Public Functions                               */

    /**
     * Performs a purchase.
     * @dev Reverts if the sale has not started.
     * @dev Reverts if the sale is paused.
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
    ) external virtual override payable whenStarted whenNotPaused {
        PurchaseData memory purchase;
        purchase.purchaser = _msgSender();
        purchase.recipient = recipient;
        purchase.token = token;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;

        _purchaseFor(purchase);
    }

    /**
     * Estimates the computed final total amount to pay for a purchase, including any potential discount.
     * @dev This function MUST compute the same price as `purchaseFor` would in identical conditions (same arguments, same point in time).
     * @dev If an implementer contract uses the `priceInfo` field, it SHOULD document how to interpret the info.
     * @dev Reverts if the sale has not started.
     * @dev Reverts if the sale is paused.
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
     * @return totalPrice The computed total price.
     * @return priceInfo Implementation-specific extra price information, such as details about potential discounts applied.
     */
    function estimatePurchase(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external virtual override view whenStarted whenNotPaused returns (uint256 totalPrice, bytes32[] memory priceInfo) {
        PurchaseData memory purchase;
        purchase.purchaser = _msgSender();
        purchase.recipient = recipient;
        purchase.token = token;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;

        return _estimatePurchase(purchase);
    }

    /**
     * Returns the information relative to a SKU.
     * @dev WARNING: it is the responsibility of the implementer to ensure that the
     * number of payment tokens is bounded, so that this function does not run out of gas.
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
        override
        view
        returns (
            uint256 totalSupply,
            uint256 remainingSupply,
            uint256 maxQuantityPerPurchase,
            address notificationsReceiver,
            address[] memory tokens,
            uint256[] memory prices
        )
    {
        SkuInfo storage skuInfo = _skuInfos[sku];
        uint256 length = skuInfo.prices.length();

        totalSupply = skuInfo.totalSupply;
        remainingSupply = skuInfo.remainingSupply;
        maxQuantityPerPurchase = skuInfo.maxQuantityPerPurchase;
        notificationsReceiver = skuInfo.notificationsReceiver;

        tokens = new address[](length);
        prices = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            (bytes32 token, bytes32 price) = skuInfo.prices.at(i);
            tokens[i] = address(uint256(token));
            prices[i] = uint256(price);
        }
    }

    /**
     * Returns the list of created SKU identifiers.
     * @return skus the list of created SKU identifiers.
     */
    function getSkus() external override view returns (bytes32[] memory skus) {
        skus = _skus.values;
    }


    /*                               Internal Utility Functions                               */

    function _setTokenPrices(
        EnumMap.Map storage tokenPrices,
        address[] memory tokens,
        uint256[] memory prices
    ) internal virtual {
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            require(token != address(0), "Sale: zero address token");
            uint256 price = prices[i];
            if (price == 0) {
                tokenPrices.remove(bytes32(uint256(token)));
            } else {
                tokenPrices.set(bytes32(uint256(token)), bytes32(price));
            }
        }
        require(tokenPrices.length() <= _tokensPerSkuCapacity, "Sale: too many tokens");
    }

    /*                               Internal Life Cycle Step Functions                               */

    /**
     * Lifecycle step which validates the purchase pre-conditions.
     * @dev Responsibilities:
     *  - Ensure that the purchase pre-conditions are met and revert if not.
     * @dev Reverts if `purchase.recipient` is the zero address.
     * @dev Reverts if `purchase.quantity` is zero.
     * @dev Reverts if `purchase.quantity` is greater than the SKU's `maxQuantityPerPurchase`.
     * @dev Reverts if `purchase.quantity` is greater than the available supply.
     * @dev If this function is overriden, the implementer SHOULD super call this before.
     * @param purchase The purchase conditions.
     */
    function _validation(PurchaseData memory purchase) internal virtual override view {
        require(purchase.recipient != address(0), "Sale: zero address recipient");
        require(purchase.quantity != 0, "Sale: zero quantity purchase");
        SkuInfo memory skuInfo = _skuInfos[purchase.sku];
        require(purchase.quantity <= skuInfo.maxQuantityPerPurchase, "Sale: above max quantity");
        if (skuInfo.totalSupply != SUPPLY_UNLIMITED) {
            require(skuInfo.remainingSupply >= purchase.quantity, "Sale: insufficient supply");
        }
    }

    /**
     * Lifecycle step which delivers the purchased SKUs to the recipient.
     * @dev Responsibilities:
     *  - Ensure the product is delivered to the recipient, if that is the contract's responsibility.
     *  - Handle any internal logic related to the delivery, including the remaining supply update;
     *  - Add any relevant extra data related to delivery in `purchase.deliveryData` and document how to interpret it.
     * @dev Reverts if there is not enough available supply.
     * @dev If this function is overriden, the implementer SHOULD super call it.
     * @param purchase The purchase conditions.
     */
    function _delivery(PurchaseData memory purchase) internal virtual override {
        SkuInfo memory skuInfo = _skuInfos[purchase.sku];
        if (skuInfo.totalSupply != SUPPLY_UNLIMITED) {
            _skuInfos[purchase.sku].remainingSupply = skuInfo.remainingSupply.sub(purchase.quantity);
        }
    }

    /**
     * Lifecycle step which notifies of the purchase.
     * @dev Responsibilities:
     *  - Manage after-purchase event(s) emission.
     *  - Handle calls to the notifications receiver contract's `onPurchaseNotificationReceived` function, if applicable.
     * @dev Reverts if `onPurchaseNotificationReceived` throws or returns an incorrect value.
     * @dev Emits the `Purchase` event. The values of `purchaseData` are the concatenated values of `priceData`, `paymentData`
     * and `deliveryData`. If not empty, the implementer MUST document how to interpret these values.
     * @dev If this function is overriden, the implementer SHOULD super call it.
     * @param purchase The purchase conditions.
     */
    function _notification(PurchaseData memory purchase) internal virtual override {
        emit Purchase(
            purchase.purchaser,
            purchase.recipient,
            purchase.token,
            purchase.sku,
            purchase.quantity,
            purchase.userData,
            purchase.totalPrice,
            purchase.pricingData,
            purchase.paymentData,
            purchase.deliveryData
        );

        address notificationsReceiver = _skuInfos[purchase.sku].notificationsReceiver;
        if (notificationsReceiver != address(0)) {
            require(
                IPurchaseNotificationsReceiver(notificationsReceiver).onPurchaseNotificationReceived(
                    purchase.purchaser,
                    purchase.recipient,
                    purchase.token,
                    purchase.sku,
                    purchase.quantity,
                    purchase.userData,
                    purchase.totalPrice,
                    purchase.pricingData,
                    purchase.paymentData,
                    purchase.deliveryData
                ) == IPurchaseNotificationsReceiver(address(0)).onPurchaseNotificationReceived.selector, // TODO precompute return value
                "Sale: wrong receiver return value"
            );
        }
    }
}
