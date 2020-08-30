// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;


/**
 * @title IOracleSale
 * An ISale which can manage pricing for some tokens through an oracle.
 * TODO
 */
interface IOracleSale /*is ISale*/{
    /**
     * Returns the price magic value used to represent an oracle-based pricing.
     * @dev MUST NOT be zero. SHOULD BE a prohibitively big value, so that it doesn’t collide with a possible price value.
     * @return the price magic value used to represent an oracle-based pricing.
     */
    function PRICE_CONVERT_VIA_ORACLE() external pure returns (uint256);

    /**
     * Returns the token used as reference for oracle-based price conversions.
     * @dev MUST NOT be the zero address.
     * @return the token used as reference for oracle-based price conversions.
     */
    function referenceToken() external view returns (address);

    /**
     * Retrieves the current rates for the `referenceToken`/`tokens` pairs via the oracle.
     * @dev Reverts if the oracle does not provide a pricing for one of the pairs.
     * @param tokens The list of tokens to retrieve the conversion rates for.
     * @return rates the rates for the `referenceToken`/`tokens` pairs retrieved via the oracle.
     */
    function conversionRates(address[] calldata tokens) external view returns (uint256[] memory rates);
}
