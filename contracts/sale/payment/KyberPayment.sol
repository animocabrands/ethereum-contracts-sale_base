// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./KyberAdapter.sol";
import "./PayoutToken.sol";
import "./Payment.sol";

/**
 * @title KyberPayment
 * A contract module that adds support for Kyber token swapping payment
 * mechanisms to sale contracts.
 */
contract KyberPayment is Payment, PayoutToken, KyberAdapter {

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     * @param kyberProxy Address of the Kyber network proxy contract to use.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_,
        address kyberProxy
    )
        Payment(payoutWallet_)
        PayoutToken(payoutToken_)
        KyberAdapter(kyberProxy)
        internal
    {}

    /**
     * Sets the ERC20 token currency accepted by the payout wallet for purchase
     *  payments.
     * @dev Emits the PayoutTokenSet event.
     * @dev Reverts if the payout token is the same as the current value.
     * @dev Reverts if the payout token is the zero address.
     * @param payoutToken_ The new ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
     function _setPayoutToken(IERC20 payoutToken_) internal override virtual {
        require(payoutToken_ != IERC20(0), "KyberPayment: zero address payout token");
        super._setPayoutToken(payoutToken_);
    }

    /**
     * Handles the transfer of payment funds.
     * @param operator The address which initiated payment (i.e. msg.sender).
     * @param paymentToken The token currency used for payment.
     * @param paymentAmount The amount of token currency to pay.
     * @param paymentData Implementation-specific internal payment data.
     * @return paymentTransfersInfo Implementation-specific payment funds
     *  transfer information.
     */
    function _handlePaymentTransfers(
        address payable operator,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] memory paymentData
    ) internal override returns (bytes32[] memory paymentTransfersInfo) {
        uint256 payoutAmount = uint256(paymentData[0]);
        uint256 minConversionRate = uint256(paymentData[1]);

        (uint256 paymentAmountSent, uint256 payoutAmountReceived) =
            _swapTokenAndHandleChange(
                paymentToken,
                paymentAmount,
                payoutToken,
                payoutAmount,
                minConversionRate,
                operator,
                address(uint160(address(this))));

        require(
            payoutToken.transfer(payoutWallet, payoutAmountReceived),
            "KyberPayment: failure in transferring ERC20 payment");

        paymentTransfersInfo = new bytes32[](2);
        paymentTransfersInfo[0] = bytes32(paymentAmountSent);
        paymentTransfersInfo[1] = bytes32(payoutAmountReceived);
    }

    /**
     * Handles the payment amount according to the implementing payment
     *  mechanism. This function may perform transformations on the payment
     *  amount and/or attach additional related information.
     * @dev Calculates the converted payment amount in the destination token
     *  currency.
     * @dev Calculates the minimum conversion rate from the destination token
     *  currency to the payment token currency.
     * @param paymentToken The token currency of the payment amount to handle.
     * @param paymentAmount The payment amount to handle.
     * @param paymentData Implementation-specific internal payment data
     *  (0:destination token (IERC20)).
     * @return paymentAmountInfo Implementation-specific payment amount
     *  information (0:destination token amount (uint256), 1:minimum conversion
     *  rate (uint256)).
     */
    function _handlePaymentAmount(
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] memory paymentData
    ) internal override virtual view returns (bytes32[] memory paymentAmountInfo) {
        IERC20 srcToken = paymentToken;
        uint256 srcAmount = paymentAmount;
        IERC20 destToken = IERC20(uint256(paymentData[0]));

        uint256 minConversionRate;

        if (srcToken == destToken) {
            minConversionRate = 1 ether;
        } else {
            (, uint256 slippageAmount) = _convertToken(srcToken, srcAmount, destToken);
        	(, minConversionRate) = kyber.getExpectedRate(destToken, srcToken, slippageAmount);
        }

        uint256 destAmount;

        if (minConversionRate == 1 ether) {
            destAmount = srcAmount;
        } else {
            destAmount = _ceilingDiv(srcAmount.mul(10**36), minConversionRate);
            destAmount = _fixTokenDecimals(srcToken, destToken, destAmount, true);
        }

        paymentAmountInfo = new bytes32[](2);
        paymentAmountInfo[0] = bytes32(destAmount);
        paymentAmountInfo[1] = bytes32(minConversionRate);
    }

}
