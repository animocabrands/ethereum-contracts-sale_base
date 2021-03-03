// Sources flattened with hardhat v2.0.9 https://hardhat.org

// File contracts/oracle/interfaces/IUniswapV2Router.sol

// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.8;

/**
 * @title IUniswapV2Router
 * Interface for the UniswapV2 router contract.
 * @dev https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/interfaces/IUniswapV2Router02.sol
 */
interface IUniswapV2Router {
    /**
     * Returns the UniswapV2 factory used by the router.
     * @return The UniswapV2 factory used by the router.
     */
    function factory() external pure returns (address);

    /**
     * Returns the canonical WETH address.
     * @return The canonical WETH address.
     */
    // solhint-disable-next-line func-name-mixedcase
    function WETH() external pure returns (address);

    /**
     * Given an output asset amount and an array of token addresses, calculates all preceding minimum input token amounts
     *  by calling `getReserves` for each pair of token addresses in the path in turn, and using these to call `getAmountIn`.
     * @dev Useful for calculating optimal token amounts before calling `swap`.
     * @param amountOut the fixed amount of output asset.
     * @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
     */
    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);

    /**
     * Receive an exact amount of tokens for as little ETH as possible, along the route determined by the path. The first element of path must be
     *  WETH, the last is the output token and any intermediate elements represent intermediate pairs to trade through (if, for example, a direct pair
     *  does not exist).
     * @dev Leftover ETH, if any, is returned to msg.sender.
     * @dev msg.value (amountInMax) is the maximum amount of ETH that can be required before the transaction reverts.
     * @param amountOut The amount of output tokens to receive.
     * @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
     * @param to Recipient of the output tokens.
     * @param deadline Unix timestamp after which the transaction will revert.
     * @return amounts The input token amount and all subsequent output token amounts.
     */
    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    /**
     * Receive an exact amount of ETH for as few input tokens as possible, along the route determined by the path. The first element of path is the
     *  input token, the last must be WETH, and any intermediate elements represent intermediate pairs to trade through (if, for example, a direct
     *  pair does not exist).
     * @dev msg.sender should have already given the router an allowance of at least amountInMax on the input token.
     * @dev If the to address is a smart contract, it must have the ability to receive ETH.
     * @param amountOut The amount of ETH to receive.
     * @param amountInMax The maximum amount of input tokens that can be required before the transaction reverts.
     * @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
     * @param to Recipient of ETH.
     * @param deadline Unix timestamp after which the transaction will revert.
     * @return amounts The input token amount and all subsequent output token amounts.
     */
    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /**
     * Receive an exact amount of output tokens for as few input tokens as possible, along the route determined by the path.
     *  The first element of path is the input token, the last is the output token, and any intermediate elements represent
     *  intermediate pairs to trade through (if, for example, a direct pair does not exist).
     * @dev msg.sender should have already given the router an allowance of at least amountInMax on the input token.
     * @param amountOut The amount of output tokens to receive.
     * @param amountInMax The maximum amount of input tokens that can be required before the transaction reverts.
     * @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
     * @param to Recipient of the output tokens.
     * @param deadline Unix timestamp after which the transaction will revert.
     * @return amounts The input token amount and all subsequent output token amounts.
     */
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}