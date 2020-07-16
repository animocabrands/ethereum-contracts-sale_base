# Changelog

## 4.0.0 (UNRELEASED)

### New Features
 * `KyberLotSale.sol`: A new lot sale contract that derives from `FixedSupplyLotSale.sol` and `KyberPayment.sol`, which implements Kyber-related sale behaviors.
 * `KyberPayment.sol`: A new payment contract that derives from `Payment.sol`, which implements Kyber-related payment behaviors.
 * `Payment.sol`: A new base payment contract.
 * `PayoutToken.sol`: A new payment contract module that adds support for a payment token to a sale contract.
 * `Sale.sol`: A new base sale contract.
 * `SimplePayment.sol`: A new payment contract that derives from `Payment.sol`, which implements simple payment behaviors.

### Breaking changes
 * `FixedSupplyLotSale.sol`: Derives from `Sale.sol`.
 * `FixedSupplyLotSale.sol`: No longer derives from `KyberAdapter.sol`.
 * `FixedSupplyLotSale.sol`: State mutability of `_validatePurchase()` and `_calculatePrice()` is restricted to `view`.
 * `KyberAdapter.sol`: Renamed `ETH_ADDRESS` constant to `KYBER_ETH_ADDRESS`.
 * `KyberAdapter.sol`: Renamed `ceilingDiv()` to `_ceilingDiv()` to conform with internal function naming conventions.
 * `SimpleSale.sol`: Revert sub-messages refactored to lowercase.
 * `SimpleSale.sol`: State mutability of `_validatePurchase()` and `_calculatePrice()` is restricted to `view`.

### Improvements
 * `FixedSupplyLotSale.sol`: All `require()` function calls are provided with appropriate error messages.
`_calculatePrice()`, `_acceptPayment()`, `_deliverGoods()`, and `_finalizePurchase()`.
 * `SimpleSale.sol`: Removed `view` modifier from `_validatePurchase()` to allow state changes in the function.

## 3.0.0 (03/07/2020)

### Breaking changes
 * Refactored the purchase as a generic lifecycle.

### Improvements
 * Updated dependency on `@animoca/ethereum-contracts-core_library` to `3.1.0`.

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
