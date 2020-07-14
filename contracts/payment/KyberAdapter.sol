// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20Detailed.sol";
import "./IKyber.sol";

/**
 * @title KyberAdapter
 * Contract module that invokes the Kyber Proxy Network contract in order to
 * provide utility functions for performing Kyber token swaps.
 */
contract KyberAdapter {
    using SafeMath for uint256;

    IKyber public kyber;

    IERC20 public KYBER_ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    constructor(address _kyberProxy) public {
        kyber = IKyber(_kyberProxy);
    }

    fallback () external payable {}

    receive () external payable {}

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
    )
    internal
    view
    returns (uint256 _destTokenAmount)
    {
        uint256 _unfixedDecimals = _getTokenDecimals(_src) + 18; // Kyber by default returns rates with 18 decimals.
        uint256 _decimals = _getTokenDecimals(_dest);

        if (_unfixedDecimals > _decimals) {
            // Divide token amount by 10^(_unfixedDecimals - _decimals) to reduce decimals.
            if (_ceiling) {
                return _ceilingDiv(_unfixedDestAmount, (10 ** (_unfixedDecimals - _decimals)));
            } else {
                return _unfixedDestAmount.div(10 ** (_unfixedDecimals - _decimals));
            }
        } else {
            // Multiply token amount with 10^(_decimals - _unfixedDecimals) to increase decimals.
            return _unfixedDestAmount.mul(10 ** (_decimals - _unfixedDecimals));
        }
    }

    function _convertToken(
        IERC20 _src,
        uint256 _srcAmount,
        IERC20 _dest
    )
    internal
    view
    returns (
        uint256 _expectedAmount,
        uint256 _slippageAmount
    )
    {
        (uint256 _expectedRate, uint256 _slippageRate) = kyber.getExpectedRate(_src, _dest, _srcAmount);

        return (
            _fixTokenDecimals(_src, _dest, _srcAmount.mul(_expectedRate), false),
            _fixTokenDecimals(_src, _dest, _srcAmount.mul(_slippageRate), false)
        );
    }

    /**
     * Retrieves the minimum token currency conversion rate for the specified
     * source currency amount into the destination tokken currency.
     * @dev To specify ETH as a conversion currency, use the constant
     *  KYBER_ETH_ADDRESS.
     * @param _src Source ERC20 currency to convert from.
     * @param _srcAmount Reference source currency amount used to derive the
     *  minimum conversion rate with.
     * @param _dest Destination ERC20 currency to convert to.
     * @return _minConversionRate The minimum token currency conversion rate of
     *  the source currency amount into the destination currency.
     */
    function _getMinConversionRate(
        IERC20 _src,
        uint256 _srcAmount,
        IERC20 _dest
    ) internal view returns (uint256 _minConversionRate) {
        if (_src == _dest) {
            _minConversionRate = 1 ether;
        } else {
            (, uint amount) = _convertToken(_src, _srcAmount, _dest);
            (, _minConversionRate) = kyber.getExpectedRate(_dest, _src, amount);
        }
    }

    /**
     * Converts the specified source currency amount into the destination
     * currency.
     * @dev To specify ETH as a conversion currency, use the constant
     *  KYBER_ETH_ADDRESS.
     * @param _src Source ERC20 currency to convert the source amount from.
     * @param _srcAmount The source currency amount to convert.
     * @param _dest Destination ERC20 currency to convert the source amount to.
     * @param _minConversionRate The minimum token currency conversion rate used
     *  in the currency conversion calculations.
     * @return _destAmount The converted source currency amount into the
     *  destination currency.
     */
    function _convertToken(
        IERC20 _src,
        uint256 _srcAmount,
        IERC20 _dest,
        uint256 _minConversionRate
    ) internal view returns (uint256 _destAmount) {
        if (_srcAmount != 0) {
            if ((_src == _dest) && (_minConversionRate == 1 ether)) {
                _destAmount = _srcAmount;
            } else {
                _destAmount = _ceilingDiv(_srcAmount.mul(10**36), _minConversionRate);
                _destAmount = _fixTokenDecimals(_src, _dest, _destAmount, true);
            }
        }
    }

    function _swapTokenAndHandleChange(
        IERC20 _src,
        uint256 _maxSrcAmount,
        IERC20 _dest,
        uint256 _maxDestAmount,
        uint256 _minConversionRate,
        address payable _initiator,
        address payable _receiver
    )
    internal
    returns (
        uint256 _srcAmount,
        uint256 _destAmount
    )
    {
        if (_src == _dest) {
            // payment is made with DAI
            require(_maxSrcAmount >= _maxDestAmount);
            _destAmount = _srcAmount = _maxDestAmount;
            require(_src.transferFrom(_initiator, address(this), _destAmount));
        } else {
            require(_src == KYBER_ETH_ADDRESS ? msg.value >= _maxSrcAmount : msg.value == 0);

            // Prepare for handling back the change if there is any.
            uint256 _balanceBefore = _getTokenBalance(_src, address(this));

            if (_src != KYBER_ETH_ADDRESS) {
                require(_src.transferFrom(_initiator, address(this), _maxSrcAmount));
                require(_src.approve(address(kyber), _maxSrcAmount));
            } else {
                // Since we are going to transfer the source amount to Kyber.
                _balanceBefore = _balanceBefore.sub(_maxSrcAmount);
            }

            _destAmount = kyber.trade{ value: _src == KYBER_ETH_ADDRESS ? _maxSrcAmount : 0 } (
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
                    require(_src.transfer(_initiator, _change));
                } else {
                    _initiator.transfer(_change);
                }
            }
        }
    }
}
