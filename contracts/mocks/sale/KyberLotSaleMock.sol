// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/KyberLotSale.sol";

contract KyberLotSaleMock is KyberLotSale {

    event UnderscoreCalculatePriceResult(
        bytes32[] priceInfo
    );

    event UnderscoreTransferFundsResult(
        bytes32[] paymentInfo
    );

    event UnderscoreGetTotalPriceInfoResult(
        bytes32[] totalPriceInfo
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
        bytes32 sku,
        uint256 quantity,
        IERC20 paymentToken,
        bytes32[] calldata extData
    )
        external
        payable
    {
        Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
                extData);

        bytes32[] memory priceInfo = _calculatePrice(purchase);

        emit UnderscoreCalculatePriceResult(priceInfo);
    }

    function callUnderscoreTransferFunds(
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
        Purchase memory purchase =
            _getPurchaseStruct(
                purchaser,
                sku,
                quantity,
                paymentToken,
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
    ) external {
        bytes32[] memory totalPriceInfo = _getTotalPriceInfo(
            purchaser,
            paymentToken,
            sku,
            quantity,
            extData);

        emit UnderscoreGetTotalPriceInfoResult(totalPriceInfo);
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

}
