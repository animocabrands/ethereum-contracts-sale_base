// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../payment/Payment.sol";

contract PaymentMock is Payment {

    constructor(
        address payable payoutWallet_
    )
        Payment(payoutWallet_)
        public
    {}

    function _handlePaymentTransfers(
        address payable /* operator */,
        IERC20 /* paymentToken */,
        uint256 /* paymentAmount */,
        bytes32[] memory /* extData */
    ) internal override returns (bytes32[] memory /* paymentTransfersInfo */) {}

}
