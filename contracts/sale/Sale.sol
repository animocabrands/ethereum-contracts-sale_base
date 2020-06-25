// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/Startable.sol";
import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

/**
 * Abstract base contract which defines the events, members, and purchase
 * lifecycle methods for a sale contract.
 */
abstract contract Sale is Context, Ownable, Startable, Pausable, PayoutWallet   {

    // special address value to represent a payment in ETH
    IERC20 public ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    event Purchased(
        address indexed purchaser,
        address operator,
        bytes32 indexed sku,
        uint256 indexed quantity,
        IERC20 paymentToken
    );

    event PayoutTokenSet(IERC20 payoutToken);

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


    //////////////////////////////// Startable /////////////////////////////////

    /**
     * Actvates, or 'starts', the contract.
     * @dev Emits the Started event.
     * @dev Emits the Unpaused event.
     * @dev Reverts if the contract has already been started.
     */
    function start() external onlyOwner {
        _start();
        _unpause();
    }

    //////////////////////////////// Pausable //////////////////////////////////

    /**
     * Pauses the contract.
     * @dev Emits the Paused event.
     * @dev Reverts if called by a non-pauser.
     * @dev Reverts if the contract is already paused.
     * @dev Reverts if the contract has not been started yet.
     */
    function pause() external onlyOwner whenStarted {
        _pause();
    }

    /**
     * Resumes the contract.
     * @dev Emits the Unpaused event.
     * @dev Reverts if called by a non-pauser.
     * @dev Reverts if the contract is not paused.
     * @dev Reverts if the contract has not been started yet.
     */
    function unpause() external onlyOwner whenStarted {
        _unpause();
    }

    ////////////////////////////////////////////////////////////////////////////

    /**
     * Sets the ERC20 token currency accepted by the payout wallet for purchase
     *  payments.
     * @dev Emits the PayoutTokenSet event.
     * @dev Reverts if the payout token is the same as the current value.
     * @param payoutToken_ The new ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    function setPayoutToken(IERC20 payoutToken_) external onlyOwner {
        require(payoutToken_ != payoutToken, "Sale: identical payout token re-assignment");
        _setPayoutToken(payoutToken_);
    }

    ////////////////////////////////////////////////////////////////////////////

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event when the function is called successfully.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     */
    function _purchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual {
        _validatePurchase(
            purchaser,
            sku,
            quantity,
            paymentToken,
            msgSender,
            msgValue,
            msgData,
            extData);

        bytes32[] memory priceInfo =
            _calculatePrice(
                purchaser,
                sku,
                quantity,
                paymentToken,
                msgSender,
                msgValue,
                msgData,
                extData);

        bytes32[] memory paymentInfo =
            _acceptPayment(
                purchaser,
                sku,
                quantity,
                paymentToken,
                priceInfo,
                msgSender,
                msgValue,
                msgData,
                extData);

        bytes32[] memory deliveryInfo =
            _deliverGoods(
                purchaser,
                sku,
                quantity,
                paymentToken,
                msgSender,
                msgValue,
                msgData,
                extData);

        bytes32[] memory finalizeInfo =
            _finalizePurchase(
                purchaser,
                sku,
                quantity,
                paymentToken,
                priceInfo,
                paymentInfo,
                deliveryInfo,
                msgSender,
                msgValue,
                msgData,
                extData);

        _notifyPurchased(
            purchaser,
            sku,
            quantity,
            paymentToken,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo,
            msgSender,
            msgValue,
            msgData,
            extData);
    }

    /**
     * Validates the given set of purchase conditions.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     */
    function _validatePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual view {}

    /**
     * Calculates the purchase price for the given set of purchase conditions.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     * @return priceInfo Implementation-specific calculated price information
     *  result.
     */
    function _calculatePrice(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual returns (bytes32[] memory priceInfo);

    /**
     * Accepts the purchase payment for the given set of purchase conditions.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param priceInfo Implementation-specific calculated price information
     *  result.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     * @return paymentInfo Implementation-specific accepted payment information
     *  result.
     */
    function _acceptPayment(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] memory priceInfo,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual returns (bytes32[] memory paymentInfo);

    /**
     * Delivers the purchased SKU item(s) to the purchaser.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     * @return deliveryInfo Implementation-specific delivery information result.
     */
    function _deliverGoods(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual returns (bytes32[] memory deliveryInfo) {}

    /**
     * Finalizes the completed purchase by performing any remaining purchase
     * housekeeping updates.
     * @param purchaser The initiating account that made the purchase.
     * @param sku The SKU of the purchased item.
     * @param quantity The quantity of SKU items purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param priceInfo Implementation-specific calculated price information
     *  result.
     * @param paymentInfo Implementation-specific accepted payment
     *  information result.
     * @param deliveryInfo Implementation-specific delivery information
     *  result.
     * @param msgSender Caller of the purchase transaction function.
     * @param msgValue Number of wei sent with the purchase transaction.
     * @param msgData Calldata supplied with the purchase transaction.
     * @param extData Implementation-specific extra input data.
     * @return finalizeInfo Implementation-specific finalize information
     *  result.
     */
    function _finalizePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo,
        address payable msgSender,
        uint256 msgValue,
        bytes memory msgData,
        bytes32[] memory extData
    ) internal virtual returns (bytes32[] memory finalizeInfo) {}

    /**
     * Triggers a notification that the purchase has been complete.
     * @dev Emits the Purchased event when the function is called successfully.
     * @param purchaser The initiating account that made the purchase.
     * @param sku The SKU of the purchased item.
     * @param quantity The quantity of SKU items purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param *priceInfo* Implementation-specific calculated price information
     *  result.
     * @param *paymentInfo* Implementation-specific accepted payment
     *  information result.
     * @param *deliveryInfo* Implementation-specific delivery information
     *  result.
     * @param *finalizeInfo* Implementation-specific finalize information
     *  result.
     * @param msgSender Caller of the purchase transaction function.
     * @param *msgValue* Number of wei sent with the purchase transaction.
     * @param *msgData* Calldata supplied with the purchase transaction.
     * @param *extData* Implementation-specific extra input data.
     */
    function _notifyPurchased(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] memory /* priceInfo */,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */,
        bytes32[] memory /* finalizeInfo */,
        address payable msgSender,
        uint256 /* msgValue */,
        bytes memory /* msgData */,
        bytes32[] memory /* extData */
    ) internal virtual {
        emit Purchased(
            purchaser,
            msgSender,
            sku,
            quantity,
            paymentToken);
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
