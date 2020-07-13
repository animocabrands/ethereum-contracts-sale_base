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

}
