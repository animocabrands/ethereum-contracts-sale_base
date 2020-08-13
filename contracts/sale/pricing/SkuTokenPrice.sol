// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/algo/EnumSet.sol";

/**
 * @title SkuTokenPrice
 * A contract module that adds support for managing the token prices for a set
 * of product SKUs.
 *
 * Sku Token Price managers have the following properites:
 *
 * - Add, remove, and check the existence of supported SKUs and tokens.
 * - There are no guarantees on the ordering of elements in the list of SKUs and
 *  tokens.
 * - Set and get the price for a given SKU and token.
 */
contract SkuTokenPrice {

    using EnumSet for EnumSet.Set;

    // mapping of SKUs to their mapping of token prices
    mapping(bytes32 => mapping(IERC20 => uint256)) private _skuTokenPrices;

    // list of supported SKUs
    EnumSet.Set private _skus;

    // list of supported tokens
    EnumSet.Set private _tokens;

    /**
     * Adds a batch of SKUs to the list of supported product SKUs.
     * @param skus The list of additional SKUs to support.
     * @return added A list of flags, corresponding to the input list of SKUs,
     *  indicating whether or not each SKU list element has been added.
     */
    function _addSkus(
        bytes32[] memory skus
    )
        internal
        returns (bool[] memory added)
    {
        uint256 numSkus = skus.length;

        added = new bool[](numSkus);

        for (uint256 index = 0; index < numSkus; ++index) {
            bytes32 sku = skus[index];
            added[index] = _skus.add(sku);
        }
    }

    /**
     * Removes a batch of SKUs from the list of supported product SKUs.
     * @param skus The list of SKUs to remove.
     * @return removed A list of flags, corresponding to the input list of SKUs,
     *  indicating whether or not each SKU list element has been removed.
     */
    function _removeSkus(
        bytes32[] memory skus
    )
        internal
        returns (bool[] memory removed)
    {
        uint256 numSkus = skus.length;

        removed = new bool[](numSkus);

        for (uint256 skuIndex = 0; skuIndex < numSkus; ++skuIndex) {
            bytes32 sku = skus[skuIndex];

            if (_skus.remove(sku)) {
                uint256 numTokens = _tokens.length();

                for (uint256 tokenIndex = 0; tokenIndex != numTokens; ++tokenIndex) {
                    IERC20 token = IERC20(address(uint256(_tokens.at(tokenIndex))));
                    delete _skuTokenPrices[sku][token];
                }

                removed[skuIndex] = true;
            } else {
                removed[skuIndex] = false;
            }
        }
    }

    /**
     * Validates whether or not the specified SKU is supported.
     * @param sku The SKU to validate.
     * @return exists True if the specified SKU is supported, false otherwise.
     */
    function _hasSku(
        bytes32 sku
    ) internal view returns (
        bool exists
    ) {
        exists = _skus.contains(sku);
    }

    /**
     * Retrieves the entire list of supported SKUs.
     */
    function _getSkus(
    ) internal view returns (
        bytes32[] memory skus
    ) {
        uint256 numSkus = _skus.length();

        skus = new bytes32[](numSkus);

        for (uint256 index = 0; index != numSkus; ++index) {
            skus[index] = _skus.at(index);
        }
    }

    /**
     * Adds a batch of IERC20 tokens to the list of supported tokens.
     * @param tokens The list of additional IERC20 tokens to support.
     * @return added A list of flags, corresponding to the input list of tokens,
     *  indicating whether or not each token list element has been added.
     */
    function _addTokens(
        IERC20[] memory tokens
    ) internal returns (
        bool[] memory added
    ) {
        uint256 numTokens = tokens.length;

        added = new bool[](numTokens);

        for (uint256 index = 0; index < numTokens; ++index) {
            IERC20 token = tokens[index];
            added[index] = _tokens.add(bytes32(uint256(address(token))));
        }
    }

    /**
     * Removes a batch of IERC20 tokens from the list of supported tokens.
     * @param tokens The list of IERC20 tokens to remove.
     * @return removed A list of flags, corresponding to the input list of
     *  IERC20 tokens, indicating whether or not each token list element has been
     *  removed.
     */
    function _removeTokens(
        IERC20[] memory tokens
    ) internal returns (
        bool[] memory removed
    ) {
        uint256 numTokens = tokens.length;

        removed = new bool[](numTokens);

        for (uint256 tokenIndex = 0; tokenIndex < numTokens; ++tokenIndex) {
            IERC20 token = tokens[tokenIndex];

            if (_tokens.remove(bytes32(uint256(address(token))))) {
                uint256 numSkus = _skus.length();

                for (uint256 skuIndex = 0; skuIndex != numSkus; ++skuIndex) {
                    bytes32 sku = _skus.at(skuIndex);
                    delete _skuTokenPrices[sku][token];
                }

                removed[tokenIndex] = true;
            } else {
                removed[tokenIndex] = false;
            }
        }
    }

    /**
     * Validates whether or not the specified ERC20 token is supported.
     * @param token The ERC20 token to validate.
     * @return exists True if the specified token is supported, false otherwise.
     */
    function _hasToken(
        IERC20 token
    ) internal view returns (
        bool exists
    ) {
        exists = _tokens.contains(bytes32(uint256(address(token))));
    }

    /**
     * Retrieves the entire list of supported ERC20 tokens.
     */
    function _getTokens(
    ) internal view returns (
        IERC20[] memory tokens
    ) {
        uint256 numTokens = _tokens.length();

        tokens = new IERC20[](numTokens);

        for (uint256 index = 0; index != numTokens; ++index) {
            tokens[index] = IERC20(address(uint256(_tokens.at(index))));
        }
    }

    /**
     * Retrieves the price for the specified supported SKU and token.
     * @dev Reverts if the specified SKU does not exist.
     * @dev Reverts is the specified ERC20 token is unsupported.
     * @param sku The SKU item whose token price will be retrieved.
     * @param token The ERC20 token whose SKU price will be retrieved.
     * @return price The retrieved price for the specified supported SKU and
     *  token.
     */
    function _getPrice(
        bytes32 sku,
        IERC20 token
    ) internal view returns (
        uint256 price
    ) {
        require(
            _skus.contains(sku),
            "SkuTokenPrice: non-existent sku");

        require(
            _tokens.contains(bytes32(uint256(address(token)))),
            "SkuTokenPrice: unsupported token");

        price = _skuTokenPrices[sku][token];
    }

    /**
     * Sets the prices for the specified supported SKU and tokens.
     * @dev Reverts if the specified SKU does not exist.
     * @dev Reverts if the token/price list lengths are not aligned.
     * @dev Reverts if any of the specified ERC20 tokens are unsupported.
     * @param sku The SKU item whose token price will be set.
     * @param tokens The list of ERC20 tokens whose SKU price will be set.
     * @param prices The list of prices to set with.
     * @return prevPrices The list of previous SKU token prices.
     */
    function _setPrices(
        bytes32 sku,
        IERC20[] memory tokens,
        uint256[] memory prices
    ) internal returns (
        uint256[] memory prevPrices
    ) {
        require(
            _skus.contains(sku),
            "SkuTokenPrice: non-existent sku");

        require(
            tokens.length == prices.length,
            "SkuTokenPrice: token/price list mis-match");

        uint256 numItems = tokens.length;

        prevPrices = new uint256[](numItems);

        for (uint256 index = 0; index != numItems; ++index) {
            IERC20 token = tokens[index];

            require(
                _tokens.contains(bytes32(uint256(address(token)))),
                "SkuTokenPrice: unsupported token");

            prevPrices[index] = _skuTokenPrices[sku][token];

            _skuTokenPrices[sku][token] = prices[index];
        }
    }

}
