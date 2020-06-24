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

    /**
     * Used as an abstract container for a related collection of extended data.
     */
    struct ExtData {
        mapping(bytes32 => bytes32) data;
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
        address payoutWallet_,
        IERC20 payoutToken_
    )
        internal
        PayoutWallet(payoutWallet_)
    {
        setPayoutToken(payoutToken_);
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
     * @dev Reverts if the payout token is the zero address.
     * @dev Reverts if the payout token is the same as the current value.
     * @param payoutToken_ The new ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    function setPayoutToken(IERC20 payoutToken_) public onlyOwner {
        require(payoutToken_ != IERC20(0), "Sale: zero address payout token");
        require(payoutToken_ != payoutToken, "Sale: identical payout token re-assignment");
        payoutToken = payoutToken_;
        emit PayoutTokenSet(payoutToken_);
    }

    ////////////////////////////////////////////////////////////////////////////

    /**
     * Retrieves pricing information for the given set of purchase conditions.
     * @param purchaser The initiating account that the pricing information is
     *  retrieved for.
     * @param sku The SKU of the item whose pricing information is retrieved.
     * @param quantity The quantity of SKU items to use in calculating the
     *  retrieved pricing information.
     * @param paymentToken The ERC20 token to use as the payment currency.
     * @param extData Implementation-specific extended input data.
     * @return priceInfo Implementation-specific pricing information result.
     */
    function _getPrice(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        ExtData memory extData
    ) internal virtual view returns (ExtData memory priceInfo);

    /**
     * Validates the given set of purchase conditions.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param extData Implementation-specific extended input data.
     */
    function _validatePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        ExtData memory extData
    ) internal virtual view {}

    /**
     * Accepts the purchase payment for the given set of purchase conditions.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param extData Implementation-specific extended input data.
     * @return paymentInfo Implementation-specific accepted payment information
     *  result.
     */
    function _acceptPayment(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        ExtData memory extData
    ) internal virtual returns (ExtData memory paymentInfo);

    /**
     * Delivers the purchased SKU item(s) to the purchaser.
     * @param purchaser The initiating account making the purchase.
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param extData Implementation-specific extended input data.
     * @return deliveryInfo Implementation-specific delivery information result.
     */
    function _deliverGoods(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        ExtData memory extData
    ) internal virtual returns (ExtData memory deliveryInfo) {}

    /**
     * Finalizes the completed purchase by performing any remaining purchase
     * housekeeping updates and/or emitting related purchase events.
     * @param purchaser The initiating account that made the purchase.
     * @param sku The SKU of the purchased item.
     * @param quantity The quantity of SKU items purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param *extData* Implementation-specific extended input data.
     */
    function _finalizePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        ExtData memory /* extData */
    ) internal virtual {
        emit Purchased(
            purchaser,
            _msgSender(),
            sku,
            quantity,
            paymentToken);
    }

}
