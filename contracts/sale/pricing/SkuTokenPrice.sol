// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

/**
 * @title SkuTokenPrice
 * A contract module that adds support for managing the token prices for a set
 * of product SKUs.
 */
contract SkuTokenPrice {

    bytes32[] private _skus;

    // position of the entry defined by a key in the `_skus` array, plus 1
    // because index 0 means that the SKU does not exist.
    mapping(bytes32 => uint256) private _skuIndexes;

    // mapping of SKUs to their mapping of token prices (SKU => token => price)
    mapping(bytes32 => EnumMap.Map) private _skuTokenPrices;

    /**
     * Retrieves the list of added product SKUs.
     * @return skus The list of added product SKUs.
     */
    function getSkus(
    ) external virtual view returns (
        bytes32[] memory skus
    ) {
        uint256 numSkus = _skus.length;

        skus = new bytes32[](numSkus);

        for (uint256 index = 0; index != numSkus; ++index) {
            skus[index] = _skus[index];
        }
    }

    /**
     * Retrieves the list of token prices set for the specified product SKU.
     * @dev Reverts if the specified product SKU does not exist.
     * @param sku The product SKU whose token prices will be retrieved.
     * @return tokens The list of tokens supported by the specified product SKU.
     * @return prices The list of associated prices for each supported token of
     *  the specified product SKU.
     */
    function getSkuTokenPrices(
        bytes32 sku
    ) external virtual view returns (
        IERC20[] memory tokens,
        uint256[] memory prices
    ) {
        require(_skuIndexes[sku] != 0, "SkuTokenPrice: non-existent sku");

        EnumMap.Map memory tokenPrices = _skuTokenPrices[sku];
        uint256 numTokenPrices = tokenPrices.length;

        tokens = new IERC20[](numTokenPrices);
        prices = new uint256[](numTokenPrices):

        for (uint256 index = 0; index != numTokenPrices; ++index) {
            (bytes32 key, bytes32 value) = tokenPrices.at(index);
            tokens[index] = IERC20(address(uint256(key)));
            prices[index] = uint256(value);
        }
    }

    /**
     * Retrieves the price for the specified supported token of the given
     * product SKU.
     * @dev Reverts if the SKU does not exist.
     * @dev Reverts if the token is not supported by the specified product SKU.
     * @param sku The product SKU whose token price will be retrieved.
     * @param token The supported token of the specified product SKU whose price
     *  will be retrieved.
     * @return price The price for the specified supported token of the given
     *  product SKU.
     */
    function getSkuTokenPrice(
        bytes32 sku,
        IERC20 token
    ) external virtual view returns (
        uint256 price
    ) {
        require(_skuIndexes[sku] != 0, "SkuTokenPrice: non-existent sku");

        EnumMap.Map memory tokenPrices = _skuTokenPrices[sku];

        bytes32 key = bytes32(uint256(address(token)));

        require(tokenPrices.contains(key), "SkuTokenPrice: unsupported token");

        price = uint256(tokenPrices.get(key));
    }

    /**
     * Sets the token prices for the specified product SKU.
     * @dev Reverts if the lengths of the `tokens` and `prices` lists are not
     *  aligned.
     * @dev A zero token price will remove the token from the supported list of
     *  tokens for the specified product SKU.
     * @dev An empty list for the `tokens` and `prices` will remove the SKU from
     *  the list of added product SKUs.
     * @dev If a SKU does not exist then the SKU will be added, provided that
     *  the `tokens` and `prices` lists are non-empty and contain a non-zero
     *  price.
     * @dev If a token does not exist for the SKU then the token will be added,
     *  provided the associated price is non-zero.
     * @param sku The product SKU to set the given token prices for.
     * @param tokens The list of tokens whose prices will be set for the
     *  specified product SKU.
     * @param prices The list of prices to set.
     */
    function setSkuTokenPrices(
        bytes32 sku,
        IERC20[] calldata tokens,
        uint256[] calldata prices
    ) external virtual {
        uint256 numTokenPrices = tokens.length;

        require(
            numTokenPrices == prices.length,
            "SkuTokenPrice: token/price list mis-match");

        uint256 skuIndex = _skuIndexes[sku];

        if (skuIndex == 0) {
            if (numTokenPrices == 0) {
                // attempting to remove all token-prices of a new SKU, nothing
                // to do
            } else {
                EnumMap.Map memory tokenPrices;

                for (uint256 index = 0; index != numTokens; ++index) {
                    uint256 price = prices[index];
                    IERC20 token = tokens[index];

                    if (price == 0) {
                        // attemping to remove a token-price of a new SKU,
                        // nothing to do
                    } else {
                        tokenPrices.set(
                            bytes32(uint256(address(token))),
                            bytes32(price));
                    }
                }

                if (tokenPrices.length != 0) {
                    _skuTokenPrices[sku] = tokenPrices;
                    _skus.push(sku);
                    _skuIndexes[sku] = _skus.length;
                }
            }
        } else {
            EnumMap.Map storage tokenPrices = _skuTokenPrices[sku];

            for (uint256 index = 0; index != numTokens; ++index) {
                uint256 price = prices[index];
                IERC20 token = tokens[index];

                if (price == 0) {
                    tokenPrices.remove(
                        bytes32(uint256(address(token))));
                } else {
                    tokenPrices.set(
                        bytes32(uint256(address(token))),
                        bytes32(price));
                }
            }

            if ((numTokenPrices == 0) || (tokenPrices.length == 0)) {
                delete _skuTokenPrices[sku];

                // to delete a key-value pair from the `_skus` array in O(1), we
                // swap the entry to delete with the last one in the array, and
                // then remove the last entry. this modifies the order of the
                // array

                uint256 toDeleteIndex = skuIndex - 1;
                uint256 lastIndex = _skus.length - 1;

                // when the entry to delete is the last one, the swap operation
                // is unnecessary. however, since this occurs so rarely, we
                // still do the swap anyway to avoid the cost of adding an 'if'
                // statement

                bytes32 lastEntry = _skus[lastIndex];

                _skus[toDeleteIndex] = lastEntry;
                _skuIndexes[lastEntry] = toDeleteIndex + 1
                _skus.pop();

                delete _skuIndexes[sku];
            }
        }
    }

}
