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

}
