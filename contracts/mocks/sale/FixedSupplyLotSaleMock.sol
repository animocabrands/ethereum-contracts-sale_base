// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-assets_inventory/contracts/mocks/token/ERC1155721/AssetsInventoryMock.sol";
import "../../sale/FixedSupplyLotSale.sol";

contract FixedSupplyLotSaleMock is FixedSupplyLotSale {

    event UnderscorePurchaseForCalled();

    event UnderscoreValidatePurchaseCalled();

    event UnderscoreCalculatePriceCalled();

    event UnderscoreAcceptPaymentCalled();

    event UnderscoreDeliverGoodsCalled();

    event UnderscoreFinalizePurchaseCalled();

    event UnderscoreNotifyPurchasedCalled();

    event UnderscoreCalculatePriceResult(
        bytes32[] priceInfo
    );

    event UnderscoreAcceptPaymentResult(
        bytes32[] paymentInfo
    );

    event UnderscoreDeliverGoodsResult(
        bytes32[] deliveryInfo
    );

    event UnderscoreFinalizePurchaseResult(
        bytes32[] finalizeInfo
    );

    constructor(
        address kyberProxy,
        address payable payoutWallet_,
        IERC20 payoutToken_,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        FixedSupplyLotSale(
            kyberProxy,
            payoutWallet_,
            payoutToken_,
            fungibleTokenId,
            inventoryContract
        )
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

    function callUnderscorePurchaseFor(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        _purchaseFor(purchase);
    }

    function callUnderscoreValidatePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        _validatePurchase(purchase);
    }

    function callUnderscoreCalculatePrice(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        bytes32[] memory priceInfo = _calculatePrice(purchase);

        emit UnderscoreCalculatePriceResult(priceInfo);
    }

    function callUnderscoreAcceptPayment(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        bytes32[] memory paymentInfo = _acceptPayment(purchase, priceInfo);

        emit UnderscoreAcceptPaymentResult(paymentInfo);
    }

    function callUnderscoreDeliverGoods(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        bytes32[] memory deliveryInfo = _deliverGoods(purchase);

        emit UnderscoreDeliverGoodsResult(deliveryInfo);
    }

    function callUnderscoreFinalizePurchase(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo,
        bytes32[] calldata paymentInfo,
        bytes32[] calldata deliveryInfo
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        bytes32[] memory finalizeInfo =
            _finalizePurchase(purchase, priceInfo, paymentInfo, deliveryInfo);

        emit UnderscoreFinalizePurchaseResult(finalizeInfo);
    }

    function callUnderscoreNotifyPurchased(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData,
        bytes32[] calldata priceInfo,
        bytes32[] calldata paymentInfo,
        bytes32[] calldata deliveryInfo,
        bytes32[] calldata finalizeInfo
    )
        external
        payable
    {
        FixedSupplyLotSale.Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        _notifyPurchased(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo);
    }

    function callUnderscoreGetPrice(
        address payable recipient,
        uint256 lotId,
        uint256 quantity
    )
        external
        view
        returns
    (
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        (totalPrice, totalDiscounts) =
            _getPrice(recipient, _lots[lotId], quantity);
    }

    function _getPurchaseStruct(
        address payable purchaser,
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] memory extData
    ) private view returns (Purchase memory purchase) {
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.paymentToken = paymentToken;
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
    ) internal override {
        super._validatePurchase(purchase);
        emit UnderscoreValidatePurchaseCalled();
    }

    function _calculatePrice(
        Purchase memory purchase
    ) internal override returns (bytes32[] memory priceInfo) {
        priceInfo = super._calculatePrice(purchase);
        emit UnderscoreCalculatePriceCalled();
    }

    function _acceptPayment(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override returns (bytes32[] memory paymentInfo) {
        paymentInfo = super._acceptPayment(purchase, priceInfo);
        emit UnderscoreAcceptPaymentCalled();
    }

    function _deliverGoods(
        Purchase memory purchase
    ) internal override returns (bytes32[] memory deliveryInfo) {
        deliveryInfo = super._deliverGoods(purchase);
        emit UnderscoreDeliverGoodsCalled();
    }

    function _finalizePurchase(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo
    ) internal override returns (bytes32[] memory finalizeInfo) {
        finalizeInfo = super._finalizePurchase(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo);
        emit UnderscoreFinalizePurchaseCalled();
    }

    function _notifyPurchased(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory paymentInfo,
        bytes32[] memory deliveryInfo,
        bytes32[] memory finalizeInfo
    ) internal override {
        super._notifyPurchased(
            purchase,
            priceInfo,
            paymentInfo,
            deliveryInfo,
            finalizeInfo);
        emit UnderscoreNotifyPurchasedCalled();
    }

}
