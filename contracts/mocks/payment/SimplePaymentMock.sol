// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../payment/SimplePayment.sol";

contract SimplePaymentMock is SimplePayment {

    event UnderscoreHandlePaymentTransfersResult(
        bytes32[] paymentTransfersInfo
    );

    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        SimplePayment(
            payoutWallet_,
            payoutToken_
        )
        public
    {}

    function callUnderscoreHandlePaymentTransfers(
        address payable operator,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32[] calldata extData
    ) external payable {
        bytes32[] memory paymentTransfersInfo = _handlePaymentTransfers(
            operator,
            paymentToken,
            paymentAmount,
            extData);

        emit UnderscoreHandlePaymentTransfersResult(paymentTransfersInfo);
    }

}
