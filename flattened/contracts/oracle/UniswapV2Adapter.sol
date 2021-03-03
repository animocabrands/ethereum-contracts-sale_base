// Sources flattened with hardhat v2.0.9 https://hardhat.org

// File @openzeppelin/contracts/math/SafeMath.sol@v3.3.0

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}


// File contracts/oracle/interfaces/IUniswapV2Router.sol

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


// File contracts/oracle/interfaces/IUniswapV2Pair.sol

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


// File contracts/oracle/UniswapV2Adapter.sol

pragma solidity 0.6.8;



/**
 * @title UniswapV2Adapter
 * Contract which helps to interact with UniswapV2 router.
 */
contract UniswapV2Adapter {
    using SafeMath for uint256;

    event UniswapV2RouterSet(IUniswapV2Router uniswapV2Router);

    IUniswapV2Router public uniswapV2Router;

    constructor(IUniswapV2Router uniswapV2Router_) public {
        _setUniswapV2Router(uniswapV2Router_);
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        // solhint-disable-next-line reason-string
        require(tokenA != tokenB, "UniswapV2Adapter: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "UniswapV2Adapter: ZERO_ADDRESS");
    }

    function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pair = address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        hex"ff",
                        uniswapV2Router.factory(),
                        keccak256(abi.encodePacked(token0, token1)),
                        hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
                    )
                )
            )
        );
    }

    function _getReserves(address tokenA, address tokenB) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = _sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(_pairFor(tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _setUniswapV2Router(IUniswapV2Router uniswapV2Router_) internal {
        uniswapV2Router = uniswapV2Router_;
        emit UniswapV2RouterSet(uniswapV2Router_);
    }

    function _getAmountsIn(
        address tokenA,
        address tokenB,
        uint256 amountB
    ) internal view returns (uint256 amount) {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        uint256[] memory amounts = uniswapV2Router.getAmountsIn(amountB, path);
        amount = amounts[0];
    }

    function _swapTokensForExactAmount(
        address tokenA,
        address tokenB,
        uint256 amountB,
        uint256 maxAmountA,
        address to,
        uint256 deadline
    ) internal returns (uint256 amount) {
        // solhint-disable-next-line reason-string
        require(tokenA != tokenB, "UniswapV2Adapter: IDENTICAL_ADDRESSES");

        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        uint256[] memory amounts;

        if (tokenA == uniswapV2Router.WETH()) {
            // solhint-disable-next-line reason-string
            require(maxAmountA == msg.value, "UniswapV2Adapter: INVALID_MAX_AMOUNT_IN");
            amounts = uniswapV2Router.swapETHForExactTokens{value: msg.value}(amountB, path, to, deadline);
        } else if (tokenB == uniswapV2Router.WETH()) {
            amounts = uniswapV2Router.swapTokensForExactETH(amountB, maxAmountA, path, to, deadline);
        } else {
            amounts = uniswapV2Router.swapTokensForExactTokens(amountB, maxAmountA, path, to, deadline);
        }

        amount = amounts[0];
    }
}