// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "./AbstractSale.sol";

/**
 * @title FixedPricesSale
 * An AbstractSale which implements a fixed prices strategy.
 *  The final implementer is responsible for implementing any additional pricing and/or delivery logic.
 */
contract FixedPricesSale is AbstractSale {
    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ the payout wallet.
     * @param skusCapacity the cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity
    ) internal AbstractSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity) {}

    /*                               Internal Life Cycle Functions                               */

    /**
     * Lifecycle step which computes the purchase price.
     * @dev Responsibilities:
     *  - Computes the pricing formula, including any discount logic and price conversion;
     *  - Set the value of `purchase.totalPrice`;
     *  - Add any relevant extra data related to pricing in `purchase.pricingData` and document how to interpret it.
     * @dev Reverts if `purchase.sku` does not exist.
     * @dev Reverts if `purchase.token` is not supported by the SKU.
     * @dev Reverts in case of price overflow.
     * @param purchase The purchase conditions.
     */
    function _pricing(PurchaseData memory purchase) internal virtual override view {
        SkuInfo storage skuInfo = _skuInfos[purchase.sku];
        require(skuInfo.totalSupply != 0, "Sale: unsupported SKU");
        EnumMap.Map storage prices = skuInfo.prices;
        uint256 unitPrice = _unitPrice(purchase, prices);
        purchase.totalPrice = unitPrice.mul(purchase.quantity);
    }

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(PurchaseData memory purchase) internal virtual override {
        if (purchase.token == TOKEN_ETH) {
            require(msg.value >= purchase.totalPrice, "Sale: insufficient ETH provided");

            payoutWallet.transfer(purchase.totalPrice);

            uint256 change = msg.value.sub(purchase.totalPrice);

            if (change != 0) {
                purchase.purchaser.transfer(change);
            }
        } else {
            require(
                IERC20(purchase.token).transferFrom(_msgSender(), payoutWallet, purchase.totalPrice),
                "Sale: ERC20 payment failed"
            );
        }
    }

    /*                               Internal Utility Functions                               */

    function _unitPrice(PurchaseData memory purchase, EnumMap.Map storage prices)
        internal
        virtual
        view
        returns (uint256 unitPrice)
    {
        unitPrice = uint256(prices.get(bytes32(uint256(purchase.token))));
        require(unitPrice != 0, "Sale: unsupported payment token");
    }
}
