// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/KyberLotSale.sol";

contract KyberLotSaleMock is KyberLotSale {

    event UnderscoreTransferFundsResult(
        bytes32[] paymentInfo
    );

    constructor(
        address kyberProxy,
        address payable payoutWallet_,
        IERC20 payoutToken_,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        KyberLotSale(
            kyberProxy,
            payoutWallet_,
            payoutToken_,
            fungibleTokenId,
            inventoryContract
        )
        public
    {}

    function callUnderscoreCalculatePrice(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
    )
        external view
        returns (bytes32[] memory priceInfo)
    {
        Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                paymentToken,
                sku,
                quantity,
                extData);

        priceInfo = _calculatePrice(purchase);
    }

    function callUnderscoreTransferFunds(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo
    )
        external
        payable
    {
        Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                paymentToken,
                sku,
                quantity,
                extData);

        bytes32[] memory paymentInfo = _transferFunds(purchase, priceInfo);

        emit UnderscoreTransferFundsResult(paymentInfo);
    }

    function callUnderscoreGetTotalPriceInfo(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
    ) external view returns (bytes32[] memory totalPriceInfo) {
        totalPriceInfo = _getTotalPriceInfo(
            purchaser,
            paymentToken,
            sku,
            quantity,
            extData);
    }

    function _getPurchaseStruct(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] memory extData
    ) private view returns (Purchase memory purchase) {
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.paymentToken = paymentToken;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.extData = extData;
    }

}
