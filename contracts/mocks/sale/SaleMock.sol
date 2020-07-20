// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/Sale.sol";

contract SaleMock is Sale {

    event UnderscorePurchaseForCalled();

    event UnderscoreCalculatePriceResult(
        bytes32[] priceInfo
    );

    event UnderscoreTransferFundsResult(
        bytes32[] paymentInfo
    );

    event UnderscoreDeliverGoodsResult(
        bytes32[] deliveryInfo
    );

    event UnderscoreFinalizePurchaseResult(
        bytes32[] finalizeInfo
    );

    constructor() public {}

    function callUnderscorePurchaseFor(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
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

        _purchaseFor(purchase);
    }

    function callUnderscoreValidatePurchase(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
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

        _validatePurchase(purchase);
    }

    function callUnderscoreCalculatePrice(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
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

        bytes32[] memory priceInfo = _calculatePrice(purchase);

        emit UnderscoreCalculatePriceResult(priceInfo);
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

    function callUnderscoreDeliverGoods(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
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

        bytes32[] memory deliveryInfo = _deliverGoods(purchase);

        emit UnderscoreDeliverGoodsResult(deliveryInfo);
    }

    function callUnderscoreFinalizePurchase(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo,
        bytes32[] calldata paymentInfo,
        bytes32[] calldata deliveryInfo
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

        bytes32[] memory finalizeInfo =
            _finalizePurchase(purchase, priceInfo, paymentInfo, deliveryInfo);

        emit UnderscoreFinalizePurchaseResult(finalizeInfo);
    }

    function callUnderscoreNotifyPurchased(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo,
        bytes32[] calldata paymentInfo,
        bytes32[] calldata deliveryInfo,
        bytes32[] calldata finalizeInfo
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

        _notifyPurchased(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo);
    }

    function callUnderscoreGetPurchasedEventExtData(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] calldata extData
    ) external view returns (bytes32[] memory extData_) {
        Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                paymentToken,
                sku,
                quantity,
                extData);

        bytes32[] memory priceInfo = new bytes32[](1);
        priceInfo[0] = bytes32(uint256(0));

        bytes32[] memory paymentInfo = new bytes32[](2);
        paymentInfo[0] = bytes32(uint256(1));
        paymentInfo[1] = bytes32(uint256(2));

        bytes32[] memory deliveryInfo = new bytes32[](3);
        deliveryInfo[0] = bytes32(uint256(3));
        deliveryInfo[1] = bytes32(uint256(4));
        deliveryInfo[2] = bytes32(uint256(5));

        bytes32[] memory finalizeInfo = new bytes32[](4);
        finalizeInfo[0] = bytes32(uint256(6));
        finalizeInfo[1] = bytes32(uint256(7));
        finalizeInfo[2] = bytes32(uint256(8));
        finalizeInfo[3] = bytes32(uint256(9));

        return _getPurchasedEventExtData(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo);
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

    function _purchaseFor(
        Purchase memory purchase
    )
        internal
        override
    {
        super._purchaseFor(purchase);
        emit UnderscorePurchaseForCalled();
    }

    function _validatePurchase(
        Purchase memory purchase
    ) internal override view {
        super._validatePurchase(purchase);

        require(uint256(purchase.sku) == 0, "SaleMock: invalid sku");
    }

    function _calculatePrice(
        Purchase memory purchase
    ) internal override view returns (bytes32[] memory priceInfo) {
        bytes32[] memory superPriceInfo = super._calculatePrice(purchase);

        priceInfo = new bytes32[](superPriceInfo.length + 1);

        for (uint256 index = 0; index < superPriceInfo.length; ++index) {
            priceInfo[index] = superPriceInfo[index];
        }

        priceInfo[superPriceInfo.length] = bytes32(uint256(1));
    }

    function _transferFunds(
        Purchase memory /* purchase */,
        bytes32[] memory /* priceInfo */
    ) internal override returns (bytes32[] memory paymentInfo) {
        paymentInfo = new bytes32[](1);
        paymentInfo[0] = bytes32(uint256(2));
    }

    function _deliverGoods(
        Purchase memory purchase
    ) internal override returns (bytes32[] memory deliveryInfo) {
        bytes32[] memory superDeliveryInfo = super._deliverGoods(purchase);

        deliveryInfo = new bytes32[](superDeliveryInfo.length + 1);

        for (uint256 index = 0; index < superDeliveryInfo.length; ++index) {
            deliveryInfo[index] = superDeliveryInfo[index];
        }

        deliveryInfo[superDeliveryInfo.length] = bytes32(uint256(3));
    }

    function _finalizePurchase(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo
    ) internal override returns (bytes32[] memory finalizeInfo) {
        bytes32[] memory superFinalizeInfo = super._finalizePurchase(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo);

        finalizeInfo = new bytes32[](superFinalizeInfo.length + 1);

        for (uint256 index = 0; index < superFinalizeInfo.length; ++index) {
            finalizeInfo[index] = superFinalizeInfo[index];
        }

        finalizeInfo[superFinalizeInfo.length] = bytes32(uint256(4));
    }

    function _getTotalPriceInfo(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes32[] memory extData
    ) internal override view returns (bytes32[] memory totalPriceInfo) {}

}
