// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title ISwapSale
 * An IOracleSale which can manage token swaps.
 */
interface ISwapSale /*is IOracleSale*/ {
    /**
     * Returns the price magic value used to represent a payment token which will be swapped for the reference token.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value, so that it doesn’t collide with a possible price value.
     * @return the price magic value used to represent a payment token which will be swapped for the reference token.
     */
    function PRICE_SWAP_TO_REFERENCE_TOKEN() external pure returns (uint256);
}
