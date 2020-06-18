// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

    constructor(
        address payable payoutWallet_,
        address erc20Token_
    )
        SimpleSale(
            payoutWallet_,
            erc20Token_
        )
        public
    {}

    function _purchaseForDelivery(PurchaseForVars memory purchaseForVars) internal override {}

}
