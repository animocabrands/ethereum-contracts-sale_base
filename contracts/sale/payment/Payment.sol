// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Payment
 * An abstract base contractm module that adds support for payment mechanisms to
 * sale contracts.
 */
abstract contract Payment is PayoutWallet {

    using SafeMath for uint256;

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     */
    constructor(
        address payable payoutWallet_
    )
        PayoutWallet(payoutWallet_)
        internal
    {}

    /**
     * Handles the transfer of payment funds.
     * @param operator The address which initiated payment (i.e. msg.sender).
     * @param paymentToken The token currency used for payment.
     * @param paymentAmount The amount of token currency to pay.
     * @param extData Implementation-specific extra input data.
     * @return paymentTransfersInfo Implementation-specific payment funds
     *  transfer information.
     */
    function _handlePaymentTransfers(
        address payable operator,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] memory extData
    ) internal virtual returns (
        bytes32[] memory paymentTransfersInfo
    );

    /**
     * Handles the payment amount according to the implementing payment
     *  mechanism. This function may perform transformations on the payment
     *  amount and/or attach additional related information.
     * @param paymentToken The token currency of the payment amount to handle.
     * @param paymentAmount The payment amount to handle.
     * @param extData Implementation-specific extra input data.
     * @return paymentAmountInfo Implementation-specific payment amount
     *  information.
     */
    function _handlePaymentAmount(
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] memory extData
    ) internal virtual view returns (
        bytes32[] memory paymentAmountInfo
    ) {}

}
