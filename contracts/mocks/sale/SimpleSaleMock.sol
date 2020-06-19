// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

    constructor(
        address payable payoutWallet_,
        IERC20 erc20Token_
    )
        SimpleSale(
            payoutWallet_,
            erc20Token_
        )
        public
    {}

    function _purchaseForDelivery(PurchaseForVars memory purchaseForVars) internal override {}

}
