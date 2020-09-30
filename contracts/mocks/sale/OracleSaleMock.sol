// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../sale/OracleSale.sol";

contract OracleSaleMock is OracleSale {
    using SafeMath for uint256;

    mapping(address => mapping(address => uint256)) public mockConversionRates;

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

    function setTokenPrices(
        bytes32 sku,
        address[] calldata tokens,
        uint256[] calldata prices
    ) external {
        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage tokenPrices = skuInfo.prices;
        _setTokenPrices(tokenPrices, tokens, prices);
    }

    function getUnitPrice(
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

    function setMockConversionRate(address fromToken, address toToken, uint256 rate) external {
        mockConversionRates[fromToken][toToken] = rate;
    }

    function _conversionRate(
        address fromToken,
        address toToken
    ) internal override view returns (uint256 rate) {
        rate = mockConversionRates[fromToken][toToken];
        require(rate != 0, "OracleSaleMock: undefined conversion rate");
    }

}
