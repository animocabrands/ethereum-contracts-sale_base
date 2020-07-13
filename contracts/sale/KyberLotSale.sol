// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../payment/KyberAdapter.sol";
import "./FixedSupplyLotSale.sol";

/**
 * Kyber lot sale contract. A fixed supply lot sale that uses Kyber token swaps
 * to accept supported ERC20 tokens as purchase payments.
 */
contract KyberLotSale is FixedSupplyLotSale, KyberAdapter {

    /**
     * @dev Constructor.
     * @param kyberProxy Kyber network proxy contract.
     * @param payoutWallet_ Account to receive payout currency tokens from the Lot sales.
     * @param payoutToken_ Payout currency token contract address.
     * @param fungibleTokenId Inventory token id of the fungible tokens bundled in a Lot item.
     * @param inventoryContract Address of the inventory contract to use in the delivery of purchased Lot items.
     */
    constructor(
        address kyberProxy,
        address payable payoutWallet_,
        IERC20 payoutToken_,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        FixedSupplyLotSale(
            payoutWallet_,
            payoutToken_,
            fungibleTokenId,
            inventoryContract
        )
        KyberAdapter(kyberProxy)
        internal
    {}

    /**
     * @dev Retrieves user purchase price information for the given quantity of Lot items.
     * @param recipient The user for whom the price information is being retrieved for.
     * @param lotId Lot id of the items from which the purchase price information will be retrieved.
     * @param quantity Quantity of Lot items from which the purchase price information will be retrieved.
     * @param paymentToken Purchase currency token contract address.
     * @return minConversionRate Minimum conversion rate from purchase tokens to payout tokens.
     * @return totalPrice Total price (excluding any discounts), in purchase currency tokens.
     * @return totalDiscounts Total discounts to apply to the total price, in purchase currency tokens.
     */
    function getPrice(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 paymentToken
    )
        external
        view
        returns
    (
        uint256 minConversionRate,
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        Lot memory lot = _lots[lotId];

        require(lot.exists, "KyberLotSale: non-existent lot");
        require(paymentToken != IERC20(0), "KyberLotSale: zero address payment token");

        (totalPrice, totalDiscounts) = _getPrice(recipient, lot, quantity);

        minConversionRate =
            _getMinConversionRate(
                payoutToken,
                totalPrice,
                paymentToken);

        totalPrice =
            _convertToken(
                payoutToken,
                totalPrice,
                paymentToken,
                minConversionRate);

        totalDiscounts =
            _convertToken(
                payoutToken,
                totalDiscounts,
                paymentToken,
                minConversionRate);
    }

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions (extData[0]:max token amount,
     *  extData[1]:min conversion rate).
     * @param priceInfo Implementation-specific calculated purchase price
     *  information (0:total price, 1:total discounts).
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information (0:purchase tokens sent, 1:payout tokens received).
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (bytes32[] memory paymentInfo) {
        uint256 maxTokenAmount = uint256(purchase.extData[0]);
        uint256 minConversionRate = uint256(purchase.extData[1]);
        uint256 totalPrice = uint256(priceInfo[0]);
        uint256 totalDiscounts = uint256(priceInfo[1]);

        uint256 totalDiscountedPrice = totalPrice.sub(totalDiscounts);

        (uint256 paymentTokensSent, uint256 payoutTokensReceived) =
            _swapTokenAndHandleChange(
                purchase.paymentToken,
                maxTokenAmount,
                payoutToken,
                totalDiscountedPrice,
                minConversionRate,
                purchase.operator,
                address(uint160(address(this))));

        require(
            payoutTokensReceived >= totalDiscountedPrice,
            "KyberLotSale: insufficient payout tokens received");
        require(
            payoutToken.transfer(payoutWallet, payoutTokensReceived),
            "KyberLotSale: failure in transferring ERC20 payment");

        paymentInfo = new bytes32[](2);
        paymentInfo[0] = bytes32(paymentTokensSent);
        paymentInfo[1] = bytes32(payoutTokensReceived);
    }

}
