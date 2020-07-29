// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

    event UnderscoreTransferFundsResult(
        bytes32[] paymentInfo
    );

    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        SimpleSale(
            payoutWallet_,
            payoutToken_
        )
        public
    {}

    function getPrice(
        bytes32 sku,
        IERC20 token
    ) external view returns (uint256 price) {
        price = _getPrice(sku, token);
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

    function _getPurchasedEventExtData(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */,
        bytes32[] memory /* finalizeInfo */
    ) internal override virtual view returns (bytes32[] memory extData) {
        extData = new bytes32[](2);
        extData[0] = priceInfo[0];
        extData[1] = purchase.extData[0];
    }

}
