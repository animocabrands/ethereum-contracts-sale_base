// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/Startable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../pricing/SkuTokenPrice.sol";

/**
 * @title Sale
 * An abstract base contract which defines the events, members, and purchase
 * lifecycle methods for a sale contract.
 */
abstract contract Sale is Context, Ownable, Startable, Pausable   {

    using SafeMath for uint256;
    using SkuTokenPrice for SkuTokenPrice.Manager;

    event InventorySkusAdded(
        bytes32[] skus,
        bool[] added
    );

    event SupportedPayoutTokensAdded(
        IERC20[] tokens,
        bool[] added
    );

    event SkuTokenPricesUpdated(
        bytes32 sku,
        IERC20[] tokens,
        uint256[] prices,
        uint256[] prevPrices
    );

    event Purchased(
        address indexed purchaser,
        address operator,
        IERC20 paymentToken,
        bytes32 indexed sku,
        uint256 indexed quantity,
        bytes32[] extData
    );

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
        bytes32[] extData;
    }

    SkuTokenPrice.Manager internal _skuTokenPrices;

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
     * @dev Emits the InventorySkusUpdated event.
     * @dev Reverts if called by any other than the owner.
     * @dev Reverts if the contract is not paused.
     * @param skus List of inventory SKUs to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding inventory SKU has been added.
     */
    function addInventorySkus(
        bytes32[] calldata skus
    )
        external onlyOwner whenPaused
        returns (bool[] memory added)
    {
        added = _skuTokenPrices.addSkus(skus);
        emit InventorySkusAdded(skus, added);
    }

    /**
     * Adds a list of ERC20 tokens to add to the supported list of payout
     * tokens.
     * @dev Emits the SupportedPayoutTokensUpdated event.
     * @dev Reverts if called by any other than the owner.
     * @dev Reverts if the contract is not paused.
     * @param tokens List of ERC20 tokens to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding ERC20 token has been added.
     */
    function addSupportedPayoutTokens(
        IERC20[] calldata tokens
    )
        external onlyOwner whenPaused
        returns (bool[] memory added)
    {
        added = _skuTokenPrices.addTokens(tokens);
        emit SupportedPayoutTokensAdded(tokens, added);
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
     */
    function setSkuTokenPrices(
        bytes32 sku,
        IERC20[] calldata tokens,
        uint256[] calldata prices
    )
        external onlyOwner whenPaused
        returns (uint256[] memory prevPrices)
    {
        prevPrices = _skuTokenPrices.setPrices(sku, tokens, prices);
        emit SkuTokenPricesUpdated(sku, tokens, prices, prevPrices);
    }

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event.
     * @param purchaser The initiating account making the purchase.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     *  purchase.
     * @param extData Deriving contract-specific extra input data.
     */
    function purchaseFor(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
    ) external payable whenStarted whenNotPaused {
        Purchase memory purchase;
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.paymentToken = paymentToken;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.extData = extData;

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
    ) internal virtual view {}

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information.
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal virtual view returns (bytes32[] memory priceInfo) {
        priceInfo = _getTotalPriceInfo(
            purchase.purchaser,
            purchase.paymentToken,
            purchase.sku,
            purchase.quantity,
            purchase.extData);
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
    ) internal virtual returns (bytes32[] memory paymentInfo);

    /**
     * Delivers the purchased SKU item(s) to the purchaser.
     * @param purchase Purchase conditions.
     * @return deliveryInfo Implementation-specific purchase delivery
     *  information.
     */
    function _deliverGoods(
        Purchase memory purchase
    ) internal virtual returns (bytes32[] memory deliveryInfo) {}

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
    ) internal virtual returns (bytes32[] memory finalizeInfo) {}

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
            _getPurchasedEventExtData(
                purchase,
                priceInfo,
                paymentInfo,
                deliveryInfo,
                finalizeInfo));
    }

    /**
     * Retrieves implementation-specific extra data passed as the Purchased
     *  event extData argument.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     * @param deliveryInfo Implementation-specific purchase delivery
     *  information.
     * @param finalizeInfo Implementation-specific purchase finalization
     *  information.
     * @return extData Implementation-specific extra data passed as the Purchased event
     *  extData argument. By default, returns (in order) the purchase.extData,
     *  _calculatePrice() result, _transferFunds() result, _deliverGoods()
     *  result, and _finalizePurchase() result.
     */
    function _getPurchasedEventExtData(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo,
        bytes32[] memory finalizeInfo
    ) internal virtual view returns (bytes32[] memory extData) {
        uint256 numItems = 0;
        numItems = numItems.add(purchase.extData.length);
        numItems = numItems.add(priceInfo.length);
        numItems = numItems.add(paymentInfo.length);
        numItems = numItems.add(deliveryInfo.length);
        numItems = numItems.add(finalizeInfo.length);

        extData = new bytes32[](numItems);

        uint256 offset = 0;

        for (uint256 index = 0; index < purchase.extData.length; index++) {
            extData[offset++] = purchase.extData[index];
        }

        for (uint256 index = 0; index < priceInfo.length; index++) {
            extData[offset++] = priceInfo[index];
        }

        for (uint256 index = 0; index < paymentInfo.length; index++) {
            extData[offset++] = paymentInfo[index];
        }

        for (uint256 index = 0; index < deliveryInfo.length; index++) {
            extData[offset++] = deliveryInfo[index];
        }

        for (uint256 index = 0; index < finalizeInfo.length; index++) {
            extData[offset++] = finalizeInfo[index];
        }
    }

    /**
     * Retrieves the total price information for the given quantity of the
     *  specified SKU item.
     * @param purchaser The account for whome the queried total price
     *  information is for.
     * @param paymentToken The ERC20 token payment currency of the total price
     *  information.
     * @param sku The SKU item whose total price information will be retrieved.
     * @param quantity The quantity of SKU items to retrieve the total price
     *  information for.
     * @param extData Implementation-specific extra input data.
     * @return totalPriceInfo Implementation-specific total price information.
     */
    function _getTotalPriceInfo(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] memory extData
    ) internal virtual view returns (bytes32[] memory totalPriceInfo);

}
