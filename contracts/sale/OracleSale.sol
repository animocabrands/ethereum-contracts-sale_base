// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./FixedPricesSale.sol";
import "./interfaces/IOracleSale.sol";

/**
 * @title OracleSale
 * A FixedPricesSale which implements an oracle-based pricing strategy in parallel of top of .
 *  
 * The inheriting contract is responsible for implementing `skusCap` and `tokensPerSkuCap` functions.
 * 
 */
abstract contract OracleSale is FixedPricesSale, IOracleSale {
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
    ) internal FixedPricesSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity) {}
}
