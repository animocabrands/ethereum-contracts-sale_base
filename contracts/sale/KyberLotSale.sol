// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./payment/KyberPayment.sol";
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
     *  information (0:total payout amount (uint256)).
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal override virtual view returns (
        bytes32[] memory priceInfo
    ) {
        bytes32[] memory totalPriceInfo = _getTotalPriceInfo(
            purchase.purchaser,
            payoutToken,
            purchase.sku,
            purchase.quantity,
            purchase.userData);

        priceInfo = new bytes32[](1);
        priceInfo[0] = totalPriceInfo[0];
    }

    /**
     * Transfers the funds of a purchase payment from the purchaser to the
     * payout wallet.
     * @dev Reverts if the payment token amount is insufficient to swap for the
     *  required payout token amount.
     * @dev Reverts if the contract has an insufficient allowance to perform
     *  token transfers from the operator.
     * @dev Reverts if the operator has an insufficient payment token balance.
     * @param purchase Purchase conditions (userData: max token amount
     *  (uint256), min conversion rate (uint256)).
     * @param priceInfo Implementation-specific calculated purchase price
     *  information (0:total payout price (uint256)).
     * @return paymentInfo Implementation-specific purchase payment funds
     *  transfer information (0:purchase tokens sent (uint256), 1:payout tokens
     *  received (uint256)).
     */
    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (
        bytes32[] memory paymentInfo
    ) {
        uint256 maxTokenAmount;
        uint256 minConversionRate;

        bytes memory data = purchase.userData;

        assembly {
            maxTokenAmount := mload(add(data, 32))
            minConversionRate := mload(add(data, 64))
        }

        bytes32[] memory extData = new bytes32[](2);
        extData[0] = priceInfo[0];
        extData[1] = bytes32(minConversionRate);

        paymentInfo = _handlePaymentTransfers(
            purchase.operator,
            purchase.paymentToken,
            maxTokenAmount,
            extData);
    }

    /**
     * Retrieves the total price information for the given quantity of the
     *  specified SKU item.
     * @dev Reverts if the specified SKU does not exist.
     * @dev Reverts is the specified ERC20 token is unsupported.
     * @param purchaser The account for whome the queried total price
     *  information is for.
     * @param paymentToken The ERC20 token payment currency of the total price
     *  information.
     * @param sku The SKU item whose total price information will be retrieved.
     * @param quantity The quantity of SKU items to retrieve the total price
     *  information for.
     * @param userData Implementation-specific extra user data.
     * @return totalPriceInfo Implementation-specific total price information
     *  (0:total payment amount (uint256), 1:minimum conversion rate (uint256)).
     */
    function _getTotalPriceInfo(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes memory userData
    ) internal override virtual view returns (
        bytes32[] memory totalPriceInfo
    ) {
        bytes32[] memory superTotalPriceInfo = super._getTotalPriceInfo(
            purchaser,
            payoutToken,
            sku,
            quantity,
            userData);

        uint256 payoutAmount = uint256(superTotalPriceInfo[0]);

        bytes32[] memory extData = new bytes32[](1);
        extData[0] = bytes32(uint256(address(paymentToken)));

        totalPriceInfo = _handlePaymentAmount(
            payoutToken,
            payoutAmount,
            extData);
    }

}
