// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../pricing/SkuTokenPrice.sol";

contract SkuTokenPriceMock {

    event AddRemoveResult(bool[] result);

    event SetPricesResult(uint256[] prevPrices);

    using SkuTokenPrice for SkuTokenPrice.Manager;

    SkuTokenPrice.Manager private _manager;

    function addSkus(
        bytes32[] calldata skus
    )
        external
        returns (bool[] memory added)
    {
        added = _manager.addSkus(skus);
        emit AddRemoveResult(added);
    }

    function removeSkus(
        bytes32[] calldata skus
    )
        external
        returns (bool[] memory removed)
    {
        removed = _manager.removeSkus(skus);
        emit AddRemoveResult(removed);
    }

    function hasSku(
        bytes32 sku
    )
        external view
        returns (bool exists)
    {
        exists = _manager.hasSku(sku);
    }

    function getSkus()
        external view
        returns (bytes32[] memory skus)
    {
        skus = _manager.getSkus();
    }

    function addTokens(
        IERC20[] calldata tokens
    )
        external
        returns (bool[] memory added)
    {
        added = _manager.addTokens(tokens);
        emit AddRemoveResult(added);
    }

    function removeTokens(
        IERC20[] calldata tokens
    )
        external
        returns (bool[] memory removed)
    {
        removed = _manager.removeTokens(tokens);
        emit AddRemoveResult(removed);
    }

    function hasToken(
        IERC20 token
    )
        external view
        returns (bool exists)
    {
        exists = _manager.hasToken(token);
    }

    function getTokens()
        external view
        returns (IERC20[] memory tokens)
    {
        tokens = _manager.getTokens();
    }

    function getPrice(
        bytes32 sku,
        IERC20 token
    )
        external view
        returns (uint256 price)
    {
        price = _manager.getPrice(sku, token);
    }

    function setPrices(
        bytes32 sku,
        IERC20[] calldata tokens,
        uint256[] calldata prices
    ) external {
        uint256[] memory prevPrices = _manager.setPrices(sku, tokens, prices);
        emit SetPricesResult(prevPrices);
    }

}
