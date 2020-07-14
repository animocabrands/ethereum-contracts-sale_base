// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "./Sale.sol";

/**
 * @title SimpleSale
 * An abstract sale contract that supports purchases made by ETH and/or an
 * ERC20-compatible token.
 */
abstract contract SimpleSale is Sale {

    event PriceUpdated(
        bytes32 sku,
        uint256 ethPrice,
        uint256 erc20Price
    );

    /**
     * Used to represent the unit price for a given purchase ID in terms of
     * ETH and/or an ERC20 token amount.
     */
    struct Price {
        uint256 ethPrice;
        uint256 erc20Price;
    }

    mapping(bytes32 /* sku */ => Price) public prices;

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        Sale(
            payoutWallet_,
            payoutToken_
        )
        internal
    {}

    /**
     * Sets the ETH/ERC20 price for the given purchase ID.
     * @dev Will emit the PriceUpdated event after calling the function successfully.
     * @param sku The SKU item whose price will be set.
     * @param ethPrice The ETH price to assign to the purchase ID.
     * @param erc20Price The ERC20 token price to assign to the purchase ID.
     */
    function setPrice(bytes32 sku, uint256 ethPrice, uint256 erc20Price) public onlyOwner {
        prices[sku] = Price(ethPrice, erc20Price);
        emit PriceUpdated(sku, ethPrice, erc20Price);
    }

    /////////////////////////////////////////// internal hooks ///////////////////////////////////

    /**
     * Validates a purchase.
     * @param purchase Purchase conditions.
     */
    function _validatePurchase(
        Purchase memory purchase
    ) internal override virtual {
        require(
            purchase.purchaser != address(0),
            "SimpleSale: purchaser cannot be the zero address");

        require(
            purchase.purchaser != address(uint160(address(this))),
            "SimpleSale: purchaser cannot be the contract address");

        require(
            purchase.quantity != 0,
            "SimpleSale: quantity cannot be zero");

        require(
            (purchase.paymentToken == ETH_ADDRESS) || (purchase.paymentToken == payoutToken),
            "SimpleSale: payment token is unsupported");
    }

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information (0:total price, 1:unit price).
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal override virtual returns (bytes32[] memory priceInfo) {
        uint256 unitPrice;

        if (purchase.paymentToken == ETH_ADDRESS) {
            unitPrice = prices[purchase.sku].ethPrice;
        } else {
            require(
                payoutToken != IERC20(0),
                "SimpleSale: ERC20 payment is unsupported");

            unitPrice = prices[purchase.sku].erc20Price;
        }

        require(unitPrice != 0, "SimpleSale: invalid SKU");

        uint256 totalPrice = unitPrice.mul(purchase.quantity);

        priceInfo = new bytes32[](2);
        priceInfo[0] = bytes32(totalPrice);
        priceInfo[1] = bytes32(unitPrice);
    }

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (bytes32[] memory /* paymentInfo */) {
        uint256 totalPrice = uint256(priceInfo[0]);

        if (purchase.paymentToken == ETH_ADDRESS) {
            require(
                msg.value >= totalPrice,
                "SimpleSale: insufficient ETH provided");

            payoutWallet.transfer(totalPrice);

            uint256 change = msg.value.sub(totalPrice);

            if (change > 0) {
                purchase.operator.transfer(change);
            }
        } else {
            require(
                payoutToken.transferFrom(purchase.operator, payoutWallet, totalPrice),
                "SimpleSale: failure in transferring ERC20 payment");
        }
    }

}
