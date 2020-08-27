// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/FixedPricesSale.sol";

contract FixedPricesSaleMock is FixedPricesSale {

    /**
     * Returns the cap for the number of managed SKUs.
     * @return the cap for the number of managed SKUs.
     */
    function skusCap() public virtual override returns (uint256) {
        return 32;
    }

    /**
     * Returns the cap for the number of tokens managed per SKU.
     * @return the cap for the number of tokens managed per SKU.
     */
    function tokensPerSkuCap() public virtual override returns (uint256) {
        return 32;
    }

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     */
    constructor(address payable payoutWallet_) FixedPricesSale(payoutWallet_) public {}

}
