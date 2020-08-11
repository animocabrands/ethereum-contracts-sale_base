// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./PayoutToken.sol";
import "./Payment.sol";

/**
 * @title SimplePayment
 * A contract module that adds support for simple payment mechanisms to sale
 * contracts.
 */
contract SimplePayment is Payment, PayoutToken {

    // special address value to represent a payment in ETH
    IERC20 public constant ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        Payment(payoutWallet_)
        PayoutToken(payoutToken_)
        internal
    {}

    /**
     * Handles the transfer of payment funds.
     * @dev Reverts if paying by ETH and there is an insufficent amount in
     *  msg.value.
     * @param operator The address which initiated payment (i.e. msg.sender).
     * @param paymentToken The token currency used for payment.
     * @param paymentAmount The amount of token currency to pay.
     * @param *auxData* Deriving contract-specific auxiliary input data.
     * @return *paymentTransfersInfo* Implementation-specific payment amount
     *  information.
     */
    function _handlePaymentTransfers(
        address payable operator,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] memory /* auxData */
    ) internal override returns (bytes32[] memory /* paymentTransfersInfo */) {
        if (paymentToken == ETH_ADDRESS) {
            require(
                msg.value >= paymentAmount,
                "SimplePayment: insufficient ETH provided");

            payoutWallet.transfer(paymentAmount);

            uint256 change = msg.value.sub(paymentAmount);

            if (change > 0) {
                operator.transfer(change);
            }
        } else {
            require(
                payoutToken.transferFrom(operator, payoutWallet, paymentAmount),
                "SimplePayment: failure in transferring ERC20 payment");
        }
    }

}
