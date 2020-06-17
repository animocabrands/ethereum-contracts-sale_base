# Changelog

## 2.0.0 (17/06/2020)

### Breaking changes
 * Contracts compiler version fixed at solidity 0.6.8.
 * Updated `@animoca/ethereum-contracts-assets_inventory` to version 3 and downgraded it to be a dev dependency.
 * `FixedSupplyLotSale.sol` references to `payoutWallet` local variables and function arguments renamed to `payoutWallet_`.
 * `FixedSupplyLotSale.sol` references to inherited `_payoutWallet` state variable renamed to `payoutWallet`.

### New Features
 * Added SPDX licence identifier header to the contracts for the MIT license.

### Bugfixes
 * Added missing package dev dependency `@animoca/ethereum-contracts-core_library`.
 * Added missing package dev dependency `@animoca/ethereum-contracts-erc20_base`.

## 1.0.1 (05/05/2020)

### Improvements
 * Updated dependency on `@animoca/ethereum-contracts-assets_inventory` to `2.0.1`.

## 1.0.0 (04/05/2020)
 * Initial commit.
