// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../payment/SimplePayment.sol";
import "./Sale.sol";

/**
 * @title SimpleSale
 * An abstract sale contract that supports purchases made by ETH and/or an
 * ERC20-compatible token.
 */
abstract contract SimpleSale is Sale, SimplePayment {

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        SimplePayment(
            payoutWallet_,
            payoutToken_
        )
        internal
    {}

    /**
     * Validates a purchase.
     * @dev Reverts if the purchaser is the zero address.
     * @dev Reverts if the purchaser is the sale contract address.
     * @dev Reverts if the purchase quantity is zero.
     * @dev Reverts if the payment token type is unsupported for the lot being purchased.
     * @param purchase Purchase conditions.
     */
    function _validatePurchase(
        Purchase memory purchase
    ) internal override virtual view {
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
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information (0:total price).
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information.
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (bytes32[] memory paymentInfo) {
        paymentInfo = _handlePaymentTransfers(
            purchase.operator,
            purchase.paymentToken,
            uint256(priceInfo[0]),
            new bytes32[](0));
    }

    /**
     * Retrieves the total price information for the given quantity of the
     *  specified SKU item.
     * @dev Reverts if the payment token is the zero address.
     * @dev Reverts if the payment token type is unsupported.
     * @dev Reverts if the SKU does not exist.
     * @param *purchaser* The account for whome the queried total price
     *  information is for.
     * @param paymentToken The ERC20 token payment currency of the total price
     *  information.
     * @param sku The SKU item whose total price information will be retrieved.
     * @param quantity The quantity of SKU items to retrieve the total price
     *  information for.
     * @param *extData* Implementation-specific extra input data.
     * @return totalPriceInfo Implementation-specific total price information
     *  (0:total price).
     */
    function _getTotalPriceInfo(
        address payable /* purchaser */,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] memory /* extData */
    ) internal override virtual view returns (bytes32[] memory totalPriceInfo) {
        require(
            paymentToken != IERC20(0),
            "SimpleSale: zero address payment token");

        uint256 unitPrice;

        if (paymentToken != ETH_ADDRESS) {
            require(
                payoutToken != IERC20(0),
                "SimpleSale: ERC20 payment is unsupported");
        }

        unitPrice = _skuTokenPrices.getPrice(sku, paymentToken);

        require(unitPrice != 0, "SimpleSale: invalid SKU");

        uint256 totalPrice = unitPrice.mul(quantity);

        totalPriceInfo = new bytes32[](1);
        totalPriceInfo[0] = bytes32(totalPrice);
    }

}
