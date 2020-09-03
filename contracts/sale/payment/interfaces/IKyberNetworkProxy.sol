// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

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
    ) external view returns (
        uint256 expectedRate,
        uint256 slippageRate
    );

    function trade(
        IERC20 src,
        uint256 srcAmount,
        IERC20 dest,
        address destAddress,
        uint256 maxDestAmount,
        uint256 minConversionRate,
        address payable platformWallet
    ) external payable returns(uint256);

}
