// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IOracleConvertSale
 * An ISale which can manage token conversion rates through an oracle.
 */
interface IOracleConvertSale /*is ISale*/ {
    /**
     * Returns the price magic value used to represent an oracle-based token conversion pricing.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value, so that it doesn’t collide with a possible price value.
     * @return The price magic value used to represent an oracle-based token conversion pricing.
     */
    function PRICE_CONVERT_VIA_ORACLE() external pure returns (uint256);

    /**
     * Retrieves the token conversion rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for one of the token pairs.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @param data Additional data with no specified format for deriving the conversion rates.
     * @return rates The conversion rates for the `tokens`/`referenceToken` pairs, retrieved via the oracle.
     */
    function conversionRates(address[] calldata tokens, bytes calldata data) external view returns (uint256[] memory rates);
}
