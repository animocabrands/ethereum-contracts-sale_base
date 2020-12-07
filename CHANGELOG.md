# Changelog

## 7.0.0

### New Features
 * Added `UniswapOracleSale.sol` and `UniswapSwapSale.sol`.
### Breaking changes
 * `Purchase` event `extData` as packed-encoded arrays.
 * Contract folders restructuring.

## 6.0.0

### New Features
 * Added `ISale.sol`, a new interface contract which defines the events and public API for sale contracts.
 * Added `PurchaseLifeCycles.sol`, `AbstractSale.sol`, `FixedPricesSale.sol` and `OracleSale.sol`.
 * Added contracts for UniswapV2 interactions.

### Breaking changes
 * Refactored the sale logic and removed the previous sale contracts.

## 5.0.0

### Breaking changes
 * `Sale.sol`: Renamed `addSupportedPayoutTokens()`, and associated `SupportedPayoutTokensAdded` event, with `addSupportedPaymentTokens()`, and `SupportedPaymentTokensAdded` event, respectively.

 ### Improvements
  * Updated dependency on `@animoca/ethereum-contracts-core_library` to `3.1.1`.

## 4.0.0

### New Features
 * `KyberLotSale.sol`: A new lot sale contract that derives from `FixedSupplyLotSale.sol` and `KyberPayment.sol`, which implements Kyber-related sale behaviors.
 * `KyberPayment.sol`: A new payment contract that derives from `Payment.sol`, which implements Kyber-related payment behaviors.
 * `Payment.sol`: A new base payment contract.
 * `PayoutToken.sol`: A new payment contract module that adds support for a payment token to a sale contract.
 * `Sale.sol`: Added support for managing SKU payout token prices.
 * `Sale.sol`: Added overridable `_getTotalPriceInfo()` for calculating the total payout price information.
 * `SimplePayment.sol`: A new payment contract that derives from `Payment.sol`, which implements simple payment behaviors.
 * `SkuTokenPrice.sol`: A new contract module that adds support for managing SKU token prices.

### Breaking changes
 * `FixedSupplyLotSale.sol`: No longer derives from `KyberAdapter.sol`, `PayoutWallet.sol`, and `Pausable.sol`.
 * `FixedSupplyLotSale.sol`: Is now an abstract contract that derives from `Sale.sol`.
 * `FixedSupplyLotSale.sol`: `LotCreated` event no longer includes the `price` parameter.
 * `FixedSupplyLotSale.sol`: Removed `LotPriceUpdated` event.
 * `FixedSupplyLotSale.sol`: Startable and pausable contract behavior is indirectly provided through `Sale.sol`.
 * `FixedSupplyLotSale.sol`: Removed payout token behavior.
 * `FixedSupplyLotSale.sol`: `createLot()` no longer accepts a `price` argument.
 * `FixedSupplyLotSale.sol`: Removed `updateLotPrice()`.
 * `FixedSupplyLotSale.sol`: `purchaseFor()` has a more generic signature and is inherited from `Sale.sol`.
 * `FixedSupplyLotSale.sol`: `_purchaseFor()` has a more generic signature and is inherited from `Sale.sol`.
 * `FixedSupplyLotSale.sol`: Removed `_purchaseForPricing()`, `_purchaseForPayment()`, `_purchaseForDelivery()`, and `_purchaseForNotify()` purchase lifecycle implementations with a new lifecycle design inherited from `Sale.sol`.
 * `FixedSupplyLotSale.sol`: Removed `getPrice()` and `_getPrice()`.
 * `IKyber.sol`: Relocated from `contracts/payment/` to `contracts/sale/payment/`.
 * `IKyberAdapter.sol`: Relocated from `contracts/payment/` to `contracts/sale/payment/`.
 * `KyberAdapter.sol`: Renamed `ETH_ADDRESS` constant to `KYBER_ETH_ADDRESS`.
 * `KyberAdapter.sol`: Renamed `ceilingDiv()` to `_ceilingDiv()` to conform with internal function naming conventions.
 * `Sale.sol`: No longer inherits from `PayoutWallet.sol`.
 * `Sale.sol`: Removed support for payout token management.
 * `Sale.sol`: Constructor no longer accepts any argument parameters.
 * `Sale.sol`: `purchaseFor()` argument parameter ordering has changed.
 * `Sale.sol`: `_calculatePrice()` state mutability has been restricted to `view`.
 * `Sale.sol`: Renamed `_acceptPayment()` to `_transferFunds()`.
 * `SimpleSale.sol`: No longer derives from `GSNRecipient.sol`.
 * `SimpleSale.sol`: Inherits from `SimplePayment.sol`.
 * `SimpleSale.sol`: Removed `setPrice()`.
 * `SimpleSale.sol`: Removed `_validatePurchase()` implementation and instead inherits the default implementation from `Sale.sol`.
 * `SimpleSale.sol`: Removed deprecated purchase lifecycle function `_calculatePrice()`.
 * `SimpleSale.sol`: Renamed `_acceptPayment()` to `_transferFunds()`.
 * `SimpleSale.sol`: Removed `_getPurchasedEventExtData()` implementation and instead inherits the default implementation from `Sale.sol`.
 * `SimpleSale.sol`: Revert sub-messages refactored to lowercase.
 * `SimpleSale.sol`: State mutability of `_validatePurchase()` and `_calculatePrice()` is restricted to `view`.
 * `purchaseFor()` function arguments have been re-ordered.

### Improvements
 * `FixedSupplyLotSale.sol`: All `require()` function calls are provided with appropriate error messages.
 * `KyberAdapter.sol`: All `require()` function calls are provided with appropriate error messages.
 * `Sale.sol`: Startable and pausable contract API methods are now public and overridable.
 * `Sale.sol`: `_validatePurchase()` provides a default set of validation checks.
 * `Sale.sol`: `_getPurchasedEventExtData()` provides a default construction of `Purchase` event extra data.
 * `SimpleSale.sol`: Removed `view` modifier from `_validatePurchase()` to allow state changes in the function.

## 3.0.0

### New Features
 * `Sale.sol`: A new base sale contract.
 * `SimpleSale.sol`: A new sale contract derived from `Sale.sol` for handling unlimited direct purchases.

### Breaking changes
 * Refactored the purchase as a generic lifecycle.

### Improvements
 * Updated dependency on `@animoca/ethereum-contracts-core_library` to `3.1.0`.

## 2.0.0

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

## 1.0.1

### Improvements
 * Updated dependency on `@animoca/ethereum-contracts-assets_inventory` to `2.0.1`.

## 1.0.0
 * Initial commit.
