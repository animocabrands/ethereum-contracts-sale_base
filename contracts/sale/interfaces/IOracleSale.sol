// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IOracleSale
 * An ISale which can manage pricing for some tokens through an oracle.
 */
interface IOracleSale /*is ISale*/{
    /**
     * Event emitted to notify about the magic values necessary for interpreting and using this interface.
     * @param TOKEN_ETH The magic value used to represent the ETH payment token.
     * @param SUPPLY_UNLIMITED The magic value used to represent an infinite, never-decreasing SKU's supply.
     * @param otherMagicValues:
     *  - [0] uint256 PRICE_CONVERT_VIA_ORACLE the price magic value used to represent an oracle-based pricing using token/`referenceToken` conversion rate.
     */
    // event MagicValues(address TOKEN_ETH, uint256 SUPPLY_UNLIMITED, bytes32[] otherMagicValues);

    /**
     * Returns the price magic value used to represent an oracle-based pricing using token/`referenceToken` conversion rate.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value.
     * @return the price magic value used to represent an oracle-based pricing using token/`referenceToken` conversion rate.
     */
    function PRICE_CONVERT_VIA_ORACLE() external pure returns (uint256);

    /**
     * Returns the token used as reference for oracle-based price conversions.
     * @dev MUST NOT be the zero address.
     * @return the token used as reference for oracle-based price conversions.
     */
    function referenceToken() external view returns (address);

    /**
     * Retrieves the current rates for the `tokens`/`referenceToken` pairs via the oracle.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @return rates the rates for the `tokens`/`referenceToken` pairs retrieved via the oracle.
     */
    function conversionRates(address[] calldata tokens) external view returns (uint256[] memory rates);
}
