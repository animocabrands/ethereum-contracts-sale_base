// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./payment/PaymentMock.sol";
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

    function hasInventorySku(
        bytes32 sku
    ) external view returns (bool exists) {
        exists = _hasSku(sku);
    }

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
        bytes32 sku = bytes32(lotId);
        require(_hasSku(sku));
        return _lots[lotId].nonFungibleSupply;
    }

    function setLotNumAvailable(
        uint256 lotId,
        uint256 numAvailable
    )
        external
    {
        bytes32 sku = bytes32(lotId);
        require(_hasSku(sku));
        require(_lots[lotId].numAvailable <= _lots[lotId].nonFungibleSupply.length);
        _lots[lotId].numAvailable = numAvailable;
    }

    function callUnderscoreValidatePurchase(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
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
                userData);

        _validatePurchase(purchase);
    }

    function callUnderscoreDeliverGoods(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
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
                userData);

        bytes32[] memory deliveryInfo = _deliverGoods(purchase);

        emit UnderscoreDeliverGoodsResult(deliveryInfo);
    }

    function callUnderscoreFinalizePurchase(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData,
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
                userData);

        bytes32[] memory finalizeInfo =
            _finalizePurchase(purchase, priceInfo, paymentInfo, deliveryInfo);

        emit UnderscoreFinalizePurchaseResult(finalizeInfo);
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
        bytes memory userData
    ) private view returns (Purchase memory purchase) {
        purchase.purchaser = purchaser;
        purchase.operator = _msgSender();
        purchase.paymentToken = paymentToken;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;
    }

}
