// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/Startable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./pricing/SkuTokenPrice.sol";
import "./ISale.sol";

/**
 * @title Sale
 * An abstract base contract which defines the events, members, and purchase
 * lifecycle methods for a sale contract.
 */
abstract contract Sale is ISale, Context, Ownable, Startable, Pausable, SkuTokenPrice {

    using SafeMath for uint256;

    /**
     * Used to wrap the purchase conditions passed to the purchase lifecycle
     * functions.
     */
    struct Purchase {
        address payable purchaser;
        address payable operator;
        IERC20 paymentToken;
        bytes32 sku;
        uint256 quantity;
        bytes userData;
    }

    /**
     * Constructor.
     * @dev Emits the Paused event.
     */
    constructor() internal {
        _pause();
    }

    /**
     * Actvates, or 'starts', the contract.
     * @dev Emits the Started event.
     * @dev Emits the Unpaused event.
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
     * @dev Emits the Paused event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the contract has not been started yet.
     * @dev Reverts if the contract is already paused.
     */
    function pause() public virtual onlyOwner whenStarted {
        _pause();
    }

    /**
     * Resumes the contract.
     * @dev Emits the Unpaused event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the contract has not been started yet.
     * @dev Reverts if the contract is not paused.
     */
    function unpause() public virtual onlyOwner whenStarted {
        _unpause();
    }

    /**
     * Adds a list of inventory SKUs to make available for purchase.
     * @dev Emits the SkusAdded event.
     * @dev Reverts if called by any other than the owner.
     * @dev Reverts if the contract is not paused.
     * @param skus List of inventory SKUs to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding inventory SKU has been added.
     */
    function addSkus(
        bytes32[] calldata skus
    ) external override onlyOwner whenPaused returns (
        bool[] memory added
    ) {
        added = _addSkus(skus);
        emit SkusAdded(skus, added);
    }

    /**
     * Retrieves the list of inventory SKUs available for purchase.
     * @return skus The list of inventory SKUs available for purchase.
     */
    function getSkus(
    ) external override view returns (
        bytes32[] memory skus
    ) {
        skus = _getSkus();
    }

    /**
     * Adds a list of ERC20 tokens to add to the supported list of payment
     * tokens.
     * @dev Emits the PaymentTokensAdded event.
     * @dev Reverts if called by any other than the owner.
     * @dev Reverts if the contract is not paused.
     * @param tokens List of ERC20 tokens to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding ERC20 token has been added.
     */
    function addPaymentTokens(
        IERC20[] calldata tokens
    ) external override onlyOwner whenPaused returns (
        bool[] memory added
    ) {
        added = _addTokens(tokens);
        emit PaymentTokensAdded(tokens, added);
    }

    /**
     * Retrieves the list of supported ERC20 payment tokens.
     * @return tokens The list of supported ERC20 payment tokens.
     */
    function getPaymentTokens(
    ) external override view returns (
        IERC20[] memory tokens
    ) {
        tokens = _getTokens();
    }

    /**
     * Sets the token prices for the specified inventory SKU.
     * @dev Emits the SkuTokenPricesUpdated event.
     * @dev Reverts if called by any other than the owner.
     * @dev Reverts if the contract is not paused.
     * @dev Reverts if the specified SKU does not exist.
     * @dev Reverts if the token/price list lengths are not aligned.
     * @dev Reverts if any of the specified ERC20 tokens are unsupported.
     * @param sku The SKU whose token prices will be set.
     * @param tokens The list of SKU payout tokens to set the price for.
     * @param prices The list of SKU token prices to set with.
     * @return prevPrices The list of sku token prices before the update.
     */
    function setSkuTokenPrices(
        bytes32 sku,
        IERC20[] calldata tokens,
        uint256[] calldata prices
    ) external override onlyOwner whenPaused returns (
        uint256[] memory prevPrices
    ) {
        prevPrices = _setPrices(sku, tokens, prices);
        emit SkuTokenPricesUpdated(sku, tokens, prices, prevPrices);
    }

    /**
     * Retrieves the undiscounted unit price of the given inventory SKU item, in
     * the specified supported ERC20 payment token currency.
     * @param sku The inventory SKU item whose undiscounted unit price will be
     *  retrieved.
     * @param token The ERC20 token currency of the retrieved price.
     * @return price The undiscounted unit price of the given inventory SKU item, in
     *  the specified supported ERC20 payment token currency.
     */
    function getSkuTokenPrice(
        bytes32 sku,
        IERC20 token
    ) external view returns (
        uint256 price
    ) {
        price = _getPrice(sku, token);
    }

    /**
     * Calculates the total price amount for the given quantity of the specified
     *  SKU item.
     * @param purchaser The account for whome the queried total price amount is
     *  for.
     * @param paymentToken The ERC20 token payment currency of the calculated
     *  total price amount.
     * @param sku The SKU item whose unit price is used to calculate the total
     *  price amount.
     * @param quantity The quantity of SKU items used to calculate the total
     *  price amount.
     * @param userData Implementation-specific extra user data.
     * @return price The calculated total price amount for the given quantity of
     *  the specified SKU item.
     */
    function getPrice(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view returns (
        uint256 price
    ) {
        bytes32[] memory totalPriceInfo =
            _getTotalPriceInfo(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData);

        price = uint256(totalPriceInfo[0]);
    }

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event.
     * @param purchaser The initiating account making the purchase.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     *  purchase.
     * @param userData Implementation-specific extra user data.
     */
    function purchaseFor(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external payable whenStarted whenNotPaused {
        Purchase memory purchase;
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.paymentToken = paymentToken;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;

        _purchaseFor(purchase);
    }

    /**
     * Defines and invokes the purchase lifecycle functions for the given
     * purchase conditions.
     * @param purchase The purchase conditions upon which the purchase is being
     *  made.
     */
    function _purchaseFor(
        Purchase memory purchase
    ) internal virtual {
        _validatePurchase(purchase);

        bytes32[] memory priceInfo =
            _calculatePrice(purchase);

        bytes32[] memory paymentInfo =
            _transferFunds(purchase, priceInfo);

        bytes32[] memory deliveryInfo =
            _deliverGoods(purchase);

        bytes32[] memory finalizeInfo =
            _finalizePurchase(purchase, priceInfo, paymentInfo, deliveryInfo);

        _notifyPurchased(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo);
    }

    /**
     * Validates a purchase.
     * @param purchase Purchase conditions.
     */
    function _validatePurchase(
        Purchase memory purchase
    ) internal virtual view {
        require(
            purchase.purchaser != address(0),
            "Sale: zero address purchaser");

        require(
            purchase.purchaser != address(uint160(address(this))),
            "Sale: contract address purchaser");

        require(
            _hasToken(purchase.paymentToken),
            "Sale: unsupported token");

        require(
            _hasSku(purchase.sku),
            "Sale: non-existent sku");

        require(
            purchase.quantity != 0,
            "Sale: zero quantity purchase");
    }

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information.
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal virtual view returns (
        bytes32[] memory priceInfo
    ) {
        priceInfo = _getTotalPriceInfo(
            purchase.purchaser,
            purchase.paymentToken,
            purchase.sku,
            purchase.quantity,
            purchase.userData);
    }

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal virtual returns (
        bytes32[] memory paymentInfo
    );

    /**
     * Delivers the purchased SKU item(s) to the purchaser.
     * @param purchase Purchase conditions.
     * @return deliveryInfo Implementation-specific purchase delivery
     *  information.
     */
    function _deliverGoods(
        Purchase memory purchase
    ) internal virtual returns (
        bytes32[] memory deliveryInfo
    ) {}

    /**
     * Finalizes the completed purchase by performing any remaining purchase
     * housekeeping updates.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     * @param deliveryInfo Implementation-specific purchase delivery
     *  information.
     * @return finalizeInfo Implementation-specific purchase finalization
     *  information.
     */
    function _finalizePurchase(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo
    ) internal virtual returns (
        bytes32[] memory finalizeInfo
    ) {}

    /**
     * Triggers a notification(s) that the purchase has been complete.
     * @dev Emits the Purchased event.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     * @param deliveryInfo Implementation-specific purchase delivery
     *  information.
     * @param finalizeInfo Implementation-specific purchase finalization
     *  information.
     */
    function _notifyPurchased(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo,
        bytes32[] memory finalizeInfo
    ) internal virtual {
        emit Purchased(
            purchase.purchaser,
            purchase.operator,
            purchase.paymentToken,
            purchase.sku,
            purchase.quantity,
            purchase.userData,
            _getPurchasedEventPurchaseData(
                priceInfo,
                paymentInfo,
                deliveryInfo,
                finalizeInfo));
    }

    /**
     * Retrieves implementation-specific derived purchase data passed as the
     *  Purchased event purchaseData argument.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     * @param deliveryInfo Implementation-specific purchase delivery
     *  information.
     * @param finalizeInfo Implementation-specific purchase finalization
     *  information.
     * @return purchaseData Implementation-specific derived purchase data
     *  passed as the Purchased event purchaseData argument. By default, returns
     *  (in order) the _calculatePrice() result, _transferFunds() result,
     *  _deliverGoods() result, and _finalizePurchase() result.
     */
    function _getPurchasedEventPurchaseData(
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo,
        bytes32[] memory finalizeInfo
    ) internal virtual view returns (
        bytes32[] memory purchaseData
    ) {
        uint256 numItems = 0;
        numItems = numItems.add(priceInfo.length);
        numItems = numItems.add(paymentInfo.length);
        numItems = numItems.add(deliveryInfo.length);
        numItems = numItems.add(finalizeInfo.length);

        purchaseData = new bytes32[](numItems);

        uint256 offset = 0;

        for (uint256 index = 0; index < priceInfo.length; index++) {
            purchaseData[offset++] = priceInfo[index];
        }

        for (uint256 index = 0; index < paymentInfo.length; index++) {
            purchaseData[offset++] = paymentInfo[index];
        }

        for (uint256 index = 0; index < deliveryInfo.length; index++) {
            purchaseData[offset++] = deliveryInfo[index];
        }

        for (uint256 index = 0; index < finalizeInfo.length; index++) {
            purchaseData[offset++] = finalizeInfo[index];
        }
    }

    /**
     * Retrieves the total price information for the given quantity of the
     *  specified SKU item.
     * @param *purchaser* The account for whome the queried total price
     *  information is for.
     * @param paymentToken The ERC20 token payment currency of the total price
     *  information.
     * @param sku The SKU item whose total price information will be retrieved.
     * @param quantity The quantity of SKU items to retrieve the total price
     *  information for.
     * @param *userData* Implementation-specific extra user data.
     * @return totalPriceInfo Implementation-specific total price information
     *  (0:total price).
     */
    function _getTotalPriceInfo(
        address payable /* purchaser */,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes memory /* userData */
    ) internal virtual view returns (
        bytes32[] memory totalPriceInfo
    ) {
        uint256 unitPrice = _getPrice(sku, paymentToken);
        uint256 totalPrice = unitPrice.mul(quantity);

        totalPriceInfo = new bytes32[](1);
        totalPriceInfo[0] = bytes32(totalPrice);
    }

}
