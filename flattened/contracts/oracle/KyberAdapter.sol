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


// File @animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol@v3.0.0

/*
https://github.com/OpenZeppelin/openzeppelin-contracts

The MIT License (MIT)

Copyright (c) 2016-2019 zOS Global Limited

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

pragma solidity 0.6.8;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 _value
    );

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}


// File @animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20Detailed.sol@v3.0.0

/*
https://github.com/OpenZeppelin/openzeppelin-contracts

The MIT License (MIT)

Copyright (c) 2016-2019 zOS Global Limited

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

pragma solidity 0.6.8;

/**
 * @dev Interface for commonly used additional ERC20 interfaces
 */
interface IERC20Detailed {

    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external view returns (uint8);
}


// File contracts/oracle/interfaces/IKyberNetworkProxy.sol

pragma solidity 0.6.8;

/**
 * @title IKyberNetworkProxy
 * Interface for the Kyber Network Proxy contract.
 * @dev https://github.com/KyberNetwork/smart-contracts/blob/master/contracts/sol6/IKyberNetworkProxy.sol
 */
interface IKyberNetworkProxy {
    /// Rate units (10 ** 18) => destQty (twei) / srcQty (twei) * 10 ** 18
    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint256 srcQty
    ) external view returns (uint256 expectedRate, uint256 slippageRate);

    function trade(
        IERC20 src,
        uint256 srcAmount,
        IERC20 dest,
        address destAddress,
        uint256 maxDestAmount,
        uint256 minConversionRate,
        address payable platformWallet
    ) external payable returns (uint256);
}


// File contracts/oracle/KyberAdapter.sol

pragma solidity 0.6.8;




/**
 * @title KyberAdapter
 * Contract module that invokes the Kyber Proxy Network contract in order to
 * provide utility functions for performing Kyber token swaps.
 */
contract KyberAdapter {
    using SafeMath for uint256;

    IKyberNetworkProxy public kyber;

    // solhint-disable-next-line var-name-mixedcase
    IERC20 public KYBER_ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    constructor(address _kyberProxy) public {
        kyber = IKyberNetworkProxy(_kyberProxy);
    }

    fallback() external payable {}

    receive() external payable {}

    function _getTokenDecimals(IERC20 _token) internal view returns (uint8 _decimals) {
        return _token != KYBER_ETH_ADDRESS ? IERC20Detailed(address(_token)).decimals() : 18;
    }

    function _getTokenBalance(IERC20 _token, address _account) internal view returns (uint256 _balance) {
        return _token != KYBER_ETH_ADDRESS ? _token.balanceOf(_account) : _account.balance;
    }

    function _ceilingDiv(uint256 a, uint256 b) internal pure returns (uint256 c) {
        return a.div(b).add(a.mod(b) > 0 ? 1 : 0);
    }

    function _fixTokenDecimals(
        IERC20 _src,
        IERC20 _dest,
        uint256 _unfixedDestAmount,
        bool _ceiling
    ) internal view returns (uint256 _destTokenAmount) {
        uint256 _unfixedDecimals = _getTokenDecimals(_src) + 18; // Kyber by default returns rates with 18 decimals.
        uint256 _decimals = _getTokenDecimals(_dest);

        if (_unfixedDecimals > _decimals) {
            // Divide token amount by 10^(_unfixedDecimals - _decimals) to reduce decimals.
            if (_ceiling) {
                return _ceilingDiv(_unfixedDestAmount, (10**(_unfixedDecimals - _decimals)));
            } else {
                return _unfixedDestAmount.div(10**(_unfixedDecimals - _decimals));
            }
        } else {
            // Multiply token amount with 10^(_decimals - _unfixedDecimals) to increase decimals.
            return _unfixedDestAmount.mul(10**(_decimals - _unfixedDecimals));
        }
    }

    function _convertToken(
        IERC20 _src,
        uint256 _srcAmount,
        IERC20 _dest
    ) internal view returns (uint256 _expectedAmount, uint256 _slippageAmount) {
        (uint256 _expectedRate, uint256 _slippageRate) = kyber.getExpectedRate(_src, _dest, _srcAmount);

        return (
            _fixTokenDecimals(_src, _dest, _srcAmount.mul(_expectedRate), false),
            _fixTokenDecimals(_src, _dest, _srcAmount.mul(_slippageRate), false)
        );
    }

    function _swapTokenAndHandleChange(
        IERC20 _src,
        uint256 _maxSrcAmount,
        IERC20 _dest,
        uint256 _maxDestAmount,
        uint256 _minConversionRate,
        address payable _initiator,
        address payable _receiver
    ) internal returns (uint256 _srcAmount, uint256 _destAmount) {
        if (_src == _dest) {
            // payment is made with DAI
            // solhint-disable-next-line reason-string
            require(_maxSrcAmount >= _maxDestAmount, "KyberAdapter: insufficient source token amount");

            _destAmount = _srcAmount = _maxDestAmount;

            // solhint-disable-next-line reason-string
            require(
                _src.transferFrom(_initiator, address(this), _destAmount),
                "KyberAdapter: failure in transferring ERC20 destination token amount"
            );
        } else {
            if (_src == KYBER_ETH_ADDRESS) {
                // solhint-disable-next-line reason-string
                require(msg.value >= _maxSrcAmount, "KyberAdapter: insufficient ETH value");
            } else {
                // solhint-disable-next-line reason-string
                require(msg.value == 0, "KyberAdapter: unexpected ETH value");
            }

            // Prepare for handling back the change if there is any.
            uint256 _balanceBefore = _getTokenBalance(_src, address(this));

            if (_src != KYBER_ETH_ADDRESS) {
                // solhint-disable-next-line reason-string
                require(_src.transferFrom(_initiator, address(this), _maxSrcAmount), "KyberAdapter: failure in transferring source token amount");
                // solhint-disable-next-line reason-string
                require(_src.approve(address(kyber), _maxSrcAmount), "KyberAdapter: failure in approving source token transfers");
            } else {
                // Since we are going to transfer the source amount to Kyber.
                _balanceBefore = _balanceBefore.sub(_maxSrcAmount);
            }

            _destAmount = kyber.trade{value: _src == KYBER_ETH_ADDRESS ? _maxSrcAmount : 0}(
                _src,
                _maxSrcAmount,
                _dest,
                _receiver,
                _maxDestAmount,
                _minConversionRate,
                address(0)
            );

            uint256 _balanceAfter = _getTokenBalance(_src, address(this));
            _srcAmount = _maxSrcAmount;

            // Handle back the change, if there is any, to the message sender.
            if (_balanceAfter > _balanceBefore) {
                uint256 _change = _balanceAfter - _balanceBefore;
                _srcAmount = _srcAmount.sub(_change);

                if (_src != KYBER_ETH_ADDRESS) {
                    // solhint-disable-next-line reason-string
                    require(_src.transfer(_initiator, _change), "KyberAdapter: failure in returning source token amount remainder");
                } else {
                    _initiator.transfer(_change);
                }
            }
        }
    }
}