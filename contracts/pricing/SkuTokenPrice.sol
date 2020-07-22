// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/algo/EnumSet.sol";

/**
 * @title SkuTokenPrice
 * A library contract that manages the token prices for a set of product SKUs.
 *
 * Sku Token Price managers have the following properites:
 *
 * - Add, remove, and check the existence of supported SKUs and tokens.
 * - There are no guarantees on the ordering of elements in the list of SKUs and
 *  tokens.
 * - Set and get the price for a given SKU and token.
 *
 * ```
 * contract Example {
 *     // Add the library methods
 *     using SkuTokenPrice for SkuTokenPrice.Manager;
 *
 *     // Declare a sku token price manager state variable
 *     SkuTokenPrice.Manager private mySkuTokenPriceManager;
 * }
 * ```
 */
library SkuTokenPrice {

    using EnumSet for EnumSet.Set;

    struct Manager {
        // mapping of SKUs to their mapping of token prices
        mapping(bytes32 => mapping(IERC20 => uint256)) skuTokenPrices;

        // list of supported SKUs
        EnumSet.Set skus;

        // list of supported tokens
        EnumSet.Set tokens;
    }

    /**
     * Adds a batch of SKUs to the list of supported product SKUs.
     * @param manager The storage instance of the SkuTokenPrice manager.
     * @param skus The list of additional SKUs to support.
     * @return added A list of flags, corresponding to the input list of SKUs,
     *  indicating whether or not each SKU list element has been added.
     */
    function addSkus(
        Manager storage manager,
        bytes32[] memory skus
    )
        internal
        returns (bool[] memory added)
    {
        uint256 numSkus = skus.length;

        added = new bool[](numSkus);

        for (uint256 index = 0; index < numSkus; ++index) {
            bytes32 sku = skus[index];
            added[index] = manager.skus.add(sku);
        }
    }

    /**
     * Removes a batch of SKUs from the list of supported product SKUs.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param skus The list of SKUs to remove.
     * @return removed A list of flags, corresponding to the input list of SKUs,
     *  indicating whether or not each SKU list element has been removed.
     */
    function removeSkus(
        Manager storage manager,
        bytes32[] memory skus
    )
        internal
        returns (bool[] memory removed)
    {
        uint256 numSkus = skus.length;

        removed = new bool[](numSkus);

        for (uint256 skuIndex = 0; skuIndex < numSkus; ++skuIndex) {
            bytes32 sku = skus[skuIndex];

            if (manager.skus.remove(sku)) {
                uint256 numTokens = manager.tokens.length();

                for (uint256 tokenIndex = 0; tokenIndex != numTokens; ++tokenIndex) {
                    IERC20 token = IERC20(address(uint256(manager.tokens.at(tokenIndex))));
                    delete manager.skuTokenPrices[sku][token];
                }

                removed[skuIndex] = true;
            } else {
                removed[skuIndex] = false;
            }
        }
    }

    /**
     * Validates whether or not the specified SKU is supported.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param sku The SKU to validate.
     * @return exists True if the specified SKU is supported, false otherwise.
     */
    function hasSku(
        Manager storage manager,
        bytes32 sku
    )
        internal view
        returns (bool exists)
    {
        exists = manager.skus.contains(sku);
    }

    /**
     * Retrieves the entire list of supported SKUs.
     * @param manager The storage instance of the SkuTokenPriceManager.
     */
    function getSkus(
        Manager storage manager
    )
        internal view
        returns (bytes32[] memory skus)
    {
        uint256 numSkus = manager.skus.length();

        skus = new bytes32[](numSkus);

        for (uint256 index = 0; index != numSkus; ++index) {
            skus[index] = manager.skus.at(index);
        }
    }

    /**
     * Adds a batch of IERC20 tokens to the list of supported tokens.
     * @param manager The storage instance of the SkuTokenPrice manager.
     * @param tokens The list of additional IERC20 tokens to support.
     * @return added A list of flags, corresponding to the input list of tokens,
     *  indicating whether or not each token list element has been added.
     */
    function addTokens(
        Manager storage manager,
        IERC20[] memory tokens
    )
        internal
        returns (bool[] memory added)
    {
        uint256 numTokens = tokens.length;

        added = new bool[](numTokens);

        for (uint256 index = 0; index < numTokens; ++index) {
            IERC20 token = tokens[index];
            added[index] = manager.tokens.add(bytes32(uint256(address(token))));
        }
    }

    /**
     * Removes a batch of IERC20 tokens from the list of supported tokens.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param tokens The list of IERC20 tokens to remove.
     * @return removed A list of flags, corresponding to the input list of
     *  IERC20 tokens, indicating whether or not each token list element has been
     *  removed.
     */
    function removeTokens(
        Manager storage manager,
        IERC20[] memory tokens
    )
        internal
        returns (bool[] memory removed)
    {
        uint256 numTokens = tokens.length;

        removed = new bool[](numTokens);

        for (uint256 tokenIndex = 0; tokenIndex < numTokens; ++tokenIndex) {
            IERC20 token = tokens[tokenIndex];

            if (manager.tokens.remove(bytes32(uint256(address(token))))) {
                uint256 numSkus = manager.skus.length();

                for (uint256 skuIndex = 0; skuIndex != numSkus; ++skuIndex) {
                    bytes32 sku = manager.skus.at(skuIndex);
                    delete manager.skuTokenPrices[sku][token];
                }

                removed[tokenIndex] = true;
            } else {
                removed[tokenIndex] = false;
            }
        }
    }

    /**
     * Validates whether or not the specified ERC20 token is supported.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param token The ERC20 token to validate.
     * @return exists True if the specified token is supported, false otherwise.
     */
    function hasToken(
        Manager storage manager,
        IERC20 token
    )
        internal view
        returns (bool exists)
    {
        exists = manager.tokens.contains(bytes32(uint256(address(token))));
    }

    /**
     * Retrieves the entire list of supported ERC20 tokens.
     * @param manager The storage instance of the SkuTokenPriceManager.
     */
    function getTokens(
        Manager storage manager
    )
        internal view
        returns (IERC20[] memory tokens)
    {
        uint256 numTokens = manager.tokens.length();

        tokens = new IERC20[](numTokens);

        for (uint256 index = 0; index != numTokens; ++index) {
            tokens[index] = IERC20(address(uint256(manager.tokens.at(index))));
        }
    }

    /**
     * Retrieves the price for the specified supported SKU and token.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param sku The SKU item whose token price will be retrieved.
     * @param token The ERC20 token whose SKU price will be retrieved.
     * @return price The retrieved price for the specified supported SKU and
     *  token.
     */
    function getPrice(
        Manager storage manager,
        bytes32 sku,
        IERC20 token
    )
        internal view
        returns (uint256 price)
    {
        require(
            manager.skus.contains(sku),
            "SkuTokenPrice: non-existent sku");

        require(
            manager.tokens.contains(bytes32(uint256(address(token)))),
            "SkuTokenPrice: unsupported token");

        price = manager.skuTokenPrices[sku][token];
    }

    /**
     * Sets the prices for the specified supported SKU and tokens.
     * @param manager The storage instance of the SkuTokenPriceManager.
     * @param sku The SKU item whose token price will be set.
     * @param tokens The list of ERC20 tokens whose SKU price will be set.
     * @param prices The list of prices to set with.
     */
    function setPrices(
        Manager storage manager,
        bytes32 sku,
        IERC20[] memory tokens,
        uint256[] memory prices
    ) internal {
        require(
            manager.skus.contains(sku),
            "SkuTokenPrice: non-existent sku");

        require(
            tokens.length == prices.length,
            "SkuTokenPrice: token/price list mis-match");

        uint256 numItems = tokens.length;

        for (uint256 index = 0; index != numItems; ++index) {
            IERC20 token = tokens[index];

            require(
                manager.tokens.contains(bytes32(uint256(address(token)))),
                "SkuTokenPrice: unsupported token");

            uint256 price = prices[index];

            manager.skuTokenPrices[sku][token] = price;
        }
    }

}
