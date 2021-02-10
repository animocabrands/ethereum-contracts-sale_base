# Changelog

## 7.0.0

### New Features
 * `IUniswapV2Pair.sol`: A new interface for interacting with Uniswap V2 token pair contracts.
 * `SwapSale.sol`: A new abstract oracle-based sale contract using token swap rates for dynamically determining SKU prices.
 * `UniswapOracleSale.sol`: A new Uniswap-based implementation of `OracleSale.sol` that uses token reserve conversion rates for dynamically determining SKU prices.
 * `UniswapSwapSale.sol`: A new Uniswap-based implementation of `SwapSale.sol` that uses token swap rates for dynamically determining SKU prices.
 * `UniswapV2Router.sol`: Added `factory()` interface for retrieving the Uniswap V2 factory used by the router.
 * `UniswapV2Router.sol`: Added `swapETHForExactTokens()` interface for performing a token swap with ETH.
 * `UniswapV2Router.sol`: Added `swapTokensForExactETH()` interface for performint a token swap to ETH.

### Breaking changes
 * `AbstractSale.sol`: Relocated from `contracts/sale/` to `contracts/sale/abstract/`.
 * `AbstractSale.sol`: Renamed to `Sale.sol`.
 * `IKyberNetworkProxy.sol`: Relocated from `contracts/sale/payment/interfaces/` to `contracts/oracle/interfaces/`.
 * `ISale.sol`: `Purchase` event pricing, payment, and delivery data parameters are aggregated into a packed encoding (`bytes`) of the arrays.
 * `IUniswapV2Router.sol`: Relocated from `contracts/sale/payment/interfaces/` to `contracts/oracle/interfaces/`.
 * `IWETH.sol`: Removed.
 * `KyberAdapter.sol`: Relocated from `contracts/sale/payment/` to `contracts/oracle/`.
 * `OracleSale.sol`: Relocated from `contracts/sale/` to `contracts/sale/abstract/`.
 * `OracleSale.sol`: Renamed `_referenceToken` state member variable to `referenceToken`.
 * `OracleSale.sol`: Removed `referenceToken()` getter function and mad `referenceToken` state member variable public.
 * `OracleSale.sol`: Changed `conversionRates()` override to accept an additional argument for implementation-specific extra `bytes` data for deriving the conversion rate.
 * `OracleSale.sol`: Changed `_conversionRate()` abstract function to accept an additiona argument for implementation-specific extra `bytes` data for deriving the conversion rate.
 * `OracleSale.sol`: Removed `_unitPrice()`.
 * `PayoutToken.sol`: Removed.
 * `PurchaseLifeCycles.sol`: Relocated from `contracts/sale/` to `contracts/sale/abstract/`.
 * `PurchaseNotificationsReceiver.sol`: Relocated from `contracts/sale/` to `contracts/sale/abstract/`.
 * `Sale.sol`: `estimatePurchase()` return parameter `priceInfo` renamed to `pricingData`.
 * `Sale.sol`: Changed `createSku()` into an internal function `_createSku()` for added flexibility in defining an implementation-specific sku creation function. 
 * `UniswapV2Adapter.sol`: Relocated from `contracts/sale/payment/` to `contracts/oracle/`.
 * `UniswapV2Adapter.sol`: Replaced `_conversionRate()` with `_getAmountsIn()` for retrieving the amount of source tokens necessary to convert into an amount of target tokens.
 * `UniswapV2Adapter.sol`: Replaced `_swap()` with `_swapTokensForExactAmount()` for performing a token swap of source tokens to target tokens.
 * Updated the `package.json` package dependency versions.
 * Removed `package-lock.json` in preference for using `yarn` as the default package manager.
 * Removed `@animoca/ethereum-contracts-assets_inventory` as a package dependency.
 * Removed `@animoca/blockchain-inventory_metadata` as a package dependency.
 * Removed `@animoca/ethereum-contracts-assets_inventory/contracts/mocks/token/ERC1155721/AssetsInventoryMock.sol` as an imported test dependency.
 * Updated the `@animoca/ethereum-contracts-core_library` package dependency version to v4.0.3.
 * Using the Hardhat toolchain for source compilation and testing instead of vanilla Truffle.

### Improvements
 * Improved/corrected NatSpec documentation.
 * `OracleSale.sol`: Added `_pricing()` override for calculating oracle-based pricing in addition to fixed pricing.
 * `OracleSale.sol`: Added `_oraclePricing()` for handling the calculation of oracle-based pricing of a purchase.
 * `PurchaseNotificationsReceiver.sol`: Minor gas optimization in its construction.
 * `Sale.sol`: Added a `require` validation to `getSkuInfo()` to ensure that the sku being queried for exists.
 * `Sale.sol`: Added a `require` validation to `_validation()` to ensure that the purchase token is not the zero address.
 * `Sale.sol`: Added a `require` validation to `_validation()` to ensure that the SKU being purchased exists.
 * `Sale.sol`: Added a `require` validation to `_validation()` to ensure that the purchase token is valid for the SKU.
 * `UniswapV2Adapter.sol`: Added `_sortTokens()` utility function for deterministically ordering a token pair.
 * `UniswapV2Adapter.sol`: Added `_pairFor()` utility function for retrieving the Uniswap V2 token pair contract for a given token pair.
 * `UniswapV2Adapter.sol`: Added `_getReserves()` utility function for retrieving the total reserve amounts for a token pair.
 * Updated the purchase scenario behavior testing so that ETH purchases and ERC20 purchases can be tested in isolation of one another.
 * Updated the `truffle-config.js` with a workaround for an issue with Truffle in a test context, which should improve test run times.

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
