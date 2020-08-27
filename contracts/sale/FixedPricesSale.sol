// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "./AbstractSale.sol";

/**
 * @title FixedPricesSale
 * An AbstractSale which implements a fixed prices strategy.
 * The inheriting contract is responsible for implementing `skusCap` and `tokensPerSkuCap` functions.
 */
abstract contract FixedPricesSale is AbstractSale {

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     */
    constructor(address payoutWallet_) internal AbstractSale(payoutWallet_) {}

    /*                               Internal Life Cycle Functions                               */

    /**
     * Lifecycle step which computes the purchase price.
     * @dev Responsibilities:
     *  - Implement the pricing formula, including any discount logic;
     *  - Set a value for `purchase.price`;
     *  - Add any relevant extra data related to pricing in `purchase.pricingData` and document how to interpret it.
     * @dev Reverts if `purchase.sku` does not exist.
     * @dev Reverts if `purchase.token` is not supported by `purchase.sku`.
     * @dev Reverts in case of price overflow.
     * @param purchase The purchase conditions.
     */
    function _pricing(PurchaseData memory purchase) internal virtual override view {
        SkuInfo storage skuInfo = _skuInfos[purchase.sku];
        require(skuInfo.totalSupply != 0, "Sale: unsupported SKU");
        EnumMap.Map storage prices = skuInfo.prices;
        uint256 unitPrice = uint256(prices.get(bytes32(uint256(purchase.token))));
        require(unitPrice != 0, "Sale: unsupported payment token");
        purchase.price = unitPrice.mul(purchase.quantity);
    }

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any price conversion and/or token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(PurchaseData memory purchase) internal virtual override {
        if (purchase.token == TOKEN_ETH) {
            require(msg.value >= purchase.price, "Sale: insufficient ETH provided");

            payoutWallet.transfer(purchase.price);

            uint256 change = msg.value.sub(purchase.price);

            if (change != 0) {
                purchase.purchaser.transfer(change);
            }
        } else {
            require(
                IERC20(purchase.token).transferFrom(_msgSender(), payoutWallet, purchase.price),
                "Sale: ERC20 payment failed"
            );
        }
    }
}
