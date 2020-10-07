// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../../sale/payment/PayoutToken.sol";

contract PayoutTokenMock is PayoutToken
{
    constructor(
        IERC20 payoutToken_
    )
        public
        PayoutToken(payoutToken_)
    {}

    function callUnderscoreSetPayoutToken(
        IERC20 payoutToken_
    ) external {
        _setPayoutToken(payoutToken_);
    }

}
