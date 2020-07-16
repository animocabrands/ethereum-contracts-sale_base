// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../payment/KyberPayment.sol";

contract KyberPaymentMock is KyberPayment {

    event UnderscoreHandlePaymentTransfersResult(
        bytes32[] paymentTransfersInfo
    );

    event UnderscoreHandlePaymentAmountResult(
        bytes32[] paymentAmountInfo
    );

    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_,
        address kyberProxy
    )
        KyberPayment(
            payoutWallet_,
            payoutToken,
            kyberProxy
        )
        public
    {}

    function callUnderscoreSetPayoutToken(
        IERC20 payoutToken_
    ) external  {
        _setPayoutToken(payoutToken_);
    }

    function callUnderscoreHandlePaymentTransfers(
        address payable operator,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] calldata extData
    ) external {
        bytes32[] memory paymentTransfersInfo = _handlePaymentTransfers(
            operator,
            paymentToken,
            paymentAmount,
            extData);

        emit UnderscoreHandlePaymentTransfersResult(paymentTransfersInfo);
    }

    function callUnderscoreHandlePaymentAmount(
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] calldata extData
    ) external {
        bytes32[] memory paymentAmountInfo = _handlePaymentAmount(
            paymentToken,
            paymentAmount,
            extData);

        emit UnderscoreHandlePaymentAmountResult(paymentAmountInfo);
    }

}
