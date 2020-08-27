// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

/**
 * @title FixedSupplyLotSale
 * Interface for the Kyber Network Proxy contract.
 * @dev https://github.com/KyberNetwork/smart-contracts/blob/master/contracts/KyberNetworkProxy.sol
 */
interface IKyber {
    
    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint srcQty
    ) external view returns (
        uint expectedRate,
        uint slippageRate
    );

    function trade(
        IERC20 src,
        uint srcAmount,
        IERC20 dest,
        address destAddress,
        uint maxDestAmount,
        uint minConversionRate,
        address walletId
    ) external payable returns(
        uint
    );

}
