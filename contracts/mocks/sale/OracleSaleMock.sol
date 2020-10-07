// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/OracleSale.sol";

contract OracleSaleMock is OracleSale {

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken
    )
        public
        OracleSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
    {}

    function callUnderscoreSetTokenPrices(
        bytes32 sku,
        address[] calldata tokens,
        uint256[] calldata prices
    ) external {
        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage tokenPrices = skuInfo.prices;
        _setTokenPrices(tokenPrices, tokens, prices);
    }

    function callUnderscoreUnitPrice(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData,
        uint256 totalPrice,
        bytes32[] calldata pricingData,
        bytes32[] calldata paymentData,
        bytes32[] calldata deliveryData
    ) external view returns (
        uint256 unitPrice
    ) {
        PurchaseData memory purchaseData;
        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;
        purchaseData.totalPrice = totalPrice;
        purchaseData.pricingData = pricingData;
        purchaseData.paymentData = paymentData;
        purchaseData.deliveryData = deliveryData;

        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage prices = skuInfo.prices;
        unitPrice = _unitPrice(purchaseData, prices);
    }

    function _pricing(
        PurchaseData memory purchase
    ) internal virtual override view {
        SkuInfo storage skuInfo = _skuInfos[purchase.sku];
        require(skuInfo.totalSupply != 0, "Sale: unsupported SKU");
        EnumMap.Map storage prices = skuInfo.prices;
        uint256 unitPrice = _unitPrice(purchase, prices);

        if (unitPrice == PRICE_VIA_ORACLE) {
            uint256 referenceUnitPrice = uint256(prices.get(bytes32(uint256(referenceToken))));
            purchase.totalPrice = referenceUnitPrice.mul(purchase.quantity);
            purchase.pricingData[0] = bytes32(uint256(10 ** 18));
        } else {
            purchase.totalPrice = unitPrice.mul(purchase.quantity);
        }
    }

}
