// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IOracleSale
 * An ISale which can manage token conversion pricing for some tokens through an oracle.
 */
interface IOracleSale /*is ISale*/{
    /**
     * Returns the price magic value used to represent an oracle-based pricing.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value, so that it doesn’t collide with a possible price value.
     * @return The price magic value used to represent an oracle-based pricing.
     */
    function PRICE_VIA_ORACLE() external pure returns (uint256);
}
