// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title ISwapSale
 * An IOracleSale which can manage token swaps.
 */
interface ISwapSale /*is IOracleSale*/ {
    /**
     * Event emitted to notify about the magic values necessary for interpreting and using this interface.
     * @param TOKEN_ETH The magic value used to represent the ETH payment token.
     * @param SUPPLY_UNLIMITED The magic value used to represent an infinite, never-decreasing SKU's supply.
     * @param otherMagicValues:
     *  - [0] uint256 PRICE_CONVERT_VIA_ORACLE the price magic value used to represent an oracle-based pricing using token/`referenceToken` conversion rate.
     *  - [1] uint256 PRICE_SWAP_TO_REFERENCE_TOKEN the price magic value used to represent a payment token which will be swapped for the reference token.
     */
    // event MagicValues(address TOKEN_ETH, uint256 SUPPLY_UNLIMITED, bytes32[] otherMagicValues);

    /**
     * Returns the price magic value used to represent a payment token which will be swapped for the reference token.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value.
     * @return the price magic value used to represent a payment token which will be swapped for the reference token.
     */
    function PRICE_SWAP_TO_REFERENCE_TOKEN() external pure returns (uint256);
}
