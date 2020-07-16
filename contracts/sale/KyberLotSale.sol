// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../payment/KyberPayment.sol";
import "./FixedSupplyLotSale.sol";

/**
 * @title KyberLotSale
 * An abstract fixed supply lot sale contract that uses Kyber token swaps to
 * accept supported ERC20 tokens as purchase payments.
 */
abstract contract KyberLotSale is FixedSupplyLotSale, KyberPayment {

    /**
     * Constructor.
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
            fungibleTokenId,
            inventoryContract
        )
        KyberPayment(
            payoutWallet_,
            payoutToken_,
            kyberProxy
        )
        internal
    {}

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information (0:total payout price).
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal override virtual view returns (bytes32[] memory priceInfo) {
        bytes32[] memory totalPriceInfo = _getTotalPriceInfo(
            purchase.purchaser,
            payoutToken,
            purchase.sku,
            purchase.quantity,
            purchase.extData);

        priceInfo = new bytes32[](1);
        priceInfo[0] = totalPriceInfo[0];
    }

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @param purchase Purchase conditions (extData[0]:max token amount,
     *  extData[1]:min conversion rate).
     * @param priceInfo Implementation-specific calculated purchase price
     *  information (0:total payout price).
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information (0:purchase tokens sent, 1:payout tokens received).
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (bytes32[] memory paymentInfo) {
        bytes32[] memory extData = new bytes32[](2);
        extData[0] = priceInfo[0];
        extData[1] = purchase.extData[1];

        paymentInfo = _handlePaymentTransfers(
            purchase.operator,
            purchase.paymentToken,
            uint256(purchase.extData[0]),
            extData);
    }

    /**
     * Retrieves the total price information for the given quantity of the
     *  specified SKU item.
     * @param purchaser The account for whome the queried total price
     *  information is for.
     * @param paymentToken The ERC20 token payment currency of the total price
     *  information.
     * @param sku The SKU item whose total price information will be retrieved.
     * @param quantity The quantity of SKU items to retrieve the total price
     *  information for.
     * @param extData Implementation-specific extra input data.
     * @return totalPriceInfo Implementation-specific total price information
     *  (0:payment amount, 1:minimum conversion rate).
     */
    function _getTotalPriceInfo(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] memory extData
    ) internal override virtual view returns (bytes32[] memory totalPriceInfo) {
        bytes32[] memory superTotalPriceInfo = super._getTotalPriceInfo(
            purchaser,
            paymentToken,
            sku,
            quantity,
            extData);

        uint256 payoutAmount = uint256(superTotalPriceInfo[0]);

        bytes32[] memory paymentAmountExtData = new bytes32[](1);
        paymentAmountExtData[0] = bytes32(uint256(address(paymentToken)));

        totalPriceInfo = _handlePaymentAmount(
            payoutToken,
            payoutAmount,
            paymentAmountExtData);
    }

}
