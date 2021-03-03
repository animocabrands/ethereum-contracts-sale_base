// Sources flattened with hardhat v2.0.9 https://hardhat.org

// File contracts/oracle/interfaces/IUniswapV2Pair.sol

// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

/**
 * @title IUniswapV2Pair
 * Interface for the UniswapV2 pair contract.
 * @dev https://github.com/Uniswap/uniswap-v2-core/blob/master/contracts/interfaces/IUniswapV2Pair.sol
 */
interface IUniswapV2Pair {
    /**
     * Returns the reserves of token0 and token1 used to price trades and distribute liquidity. Also returns the
     *  block.timestamp (mod 2**32) of the last block during which an interaction occured for the pair.
     */
    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        );
}