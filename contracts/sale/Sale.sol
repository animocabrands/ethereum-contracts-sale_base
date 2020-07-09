// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/Startable.sol";
import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * Abstract base contract which defines the events, members, and purchase
 * lifecycle methods for a sale contract.
 */
abstract contract Sale is Context, Ownable, Startable, Pausable, PayoutWallet   {

    using SafeMath for uint256;

    // special address value to represent a payment in ETH
    IERC20 public constant ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    event Purchased(
        address indexed purchaser,
        address operator,
        bytes32 indexed sku,
        uint256 indexed quantity,
        IERC20 paymentToken,
        bytes32[] extData
    );

    event PayoutTokenSet(IERC20 payoutToken);

    /**
     * Used to wrap the purchase conditions passed to the purchase lifecycle
     * functions.
     */
    struct Purchase {
        address payable purchaser;
        address payable operator;
        bytes32 sku;
        uint256 quantity;
        IERC20 paymentToken;
        bytes32[] extData;
    }

    IERC20 public payoutToken;

    /**
     * Constructor.
     * @dev Emits the PayoutWalletSet event.
     * @dev Emits the PayoutTokenSet event.
     * @dev Emits the Paused event.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        PayoutWallet(payoutWallet_)
        internal
    {
        _setPayoutToken(payoutToken_);
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
     * Sets the ERC20 token currency accepted by the payout wallet for purchase
     *  payments.
     * @dev Emits the PayoutTokenSet event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the payout token is the same as the current value.
     * @param payoutToken_ The new ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    function setPayoutToken(IERC20 payoutToken_) public virtual onlyOwner {
        require(payoutToken_ != payoutToken, "Sale: identical payout token re-assignment");
        _setPayoutToken(payoutToken_);
    }

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param extData Deriving contract-specific extra input data.
     */
    function purchaseFor(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    ) external payable whenStarted whenNotPaused {
        Purchase memory purchase;
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.paymentToken = paymentToken;
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
    ) internal virtual {}

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information.
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal virtual returns (bytes32[] memory priceInfo);

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
            purchase.sku,
            purchase.quantity,
            purchase.paymentToken,
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
     * Sets the ERC20 token currency accepted by the payout wallet for purchase
     *  payments.
     * @dev Emits the PayoutTokenSet event.
     * @param payoutToken_ The new ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    function _setPayoutToken(IERC20 payoutToken_) internal {
        payoutToken = payoutToken_;
        emit PayoutTokenSet(payoutToken_);
    }

}
