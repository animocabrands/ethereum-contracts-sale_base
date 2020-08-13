// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./payment/SimplePayment.sol";
import "./Sale.sol";

/**
 * @title SimpleSale
 * An abstract sale contract that supports purchases made by ETH and/or an
 * ERC20-compatible token.
 */
abstract contract SimpleSale is Sale, SimplePayment {

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        SimplePayment(
            payoutWallet_,
            payoutToken_
        )
        internal
    {}

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information (0:total price).
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (
        bytes32[] memory paymentInfo
    ) {
        paymentInfo = _handlePaymentTransfers(
            purchase.operator,
            purchase.paymentToken,
            uint256(priceInfo[0]),
            new bytes32[](0));
    }

}
