// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IOracleSwapSale
 * An IOracleSale which can manage token swap pricing for some tokens through an oracle.
 */
interface IOracleSwapSale /*is IOracleSale*/ {
    /**
     * Returns the price magic value used to represent an oracle-based token swap pricing.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value, so that it doesn’t collide with a possible price value.
     * @return The price magic value used to represent an oracle-based token swap pricing.
     */
    function PRICE_SWAP_VIA_ORACLE() external pure returns (uint256);

    /**
     * Retrieves the token swap rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a swap rate for one of the token pairs.
     * @param tokens The list of tokens to retrieve the swap rates for.
     * @param referenceAmount The amount of `referenceToken` to retrieve the swap rates for.
     * @param data Additional data with no specified format for deriving the swap rates.
     * @return rates The swap rates for the `tokens`/`referenceToken` pairs, retrieved via the oracle.
     */
    function swapRates(address[] calldata tokens, uint256 referenceAmount, bytes calldata data) external view returns (uint256[] memory rates);
}
