// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/FixedPricesSale.sol";

contract FixedPricesSaleMock is FixedPricesSale {

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     * @param skusCapacity the cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity
    ) public FixedPricesSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity) {}

}
