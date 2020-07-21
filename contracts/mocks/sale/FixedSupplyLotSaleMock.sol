// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../payment/PaymentMock.sol";
import "../../sale/FixedSupplyLotSale.sol";

contract FixedSupplyLotSaleMock is FixedSupplyLotSale, PaymentMock {

    event UnderscoreDeliverGoodsResult(
        bytes32[] deliveryInfo
    );

    event UnderscoreFinalizePurchaseResult(
        bytes32[] finalizeInfo
    );

    constructor(
        address payable payoutWallet_,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        FixedSupplyLotSale(
            fungibleTokenId,
            inventoryContract
        )
        PaymentMock(payoutWallet_)
        public
    {}

    function getLotNonFungibleSupply(
        uint256 lotId
    )
        external
        view
        returns
    (
        uint256[] memory
    )
    {
        require(_lots[lotId].exists);
        return _lots[lotId].nonFungibleSupply;
    }

    function setLotNumAvailable(
        uint256 lotId,
        uint256 numAvailable
    )
        external
    {
        require(_lots[lotId].exists);
        require(_lots[lotId].numAvailable <= _lots[lotId].nonFungibleSupply.length);
        _lots[lotId].numAvailable = numAvailable;
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

    function _transferFunds(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override returns (bytes32[] memory paymentInfo) {}

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
