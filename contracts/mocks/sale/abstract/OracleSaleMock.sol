// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../../sale/abstract/OracleSale.sol";

contract OracleSaleMock is OracleSale {
    using SafeMath for uint256;

    event UnderscoreOraclePricingResult(bool handled, bytes32[] pricingData, uint256 totalPrice);

    mapping(address => mapping(address => uint256)) public mockConversionRates;

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken
    ) public OracleSale(payoutWallet_, skusCapacity, tokensPerSkuCapacity, referenceToken) {}

    function createSku(
        bytes32 sku,
        uint256 totalSupply,
        uint256 maxQuantityPerPurchase,
        address notificationsReceiver
    ) external {
        _createSku(sku, totalSupply, maxQuantityPerPurchase, notificationsReceiver);
    }

    function setMockConversionRate(
        address fromToken,
        address toToken,
        uint256 rate
    ) external {
        mockConversionRates[fromToken][toToken] = rate;
    }

    function callUnderscoreOraclePricing(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external {
        PurchaseData memory purchaseData;
        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;

        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage tokenPrices = skuInfo.prices;
        uint256 unitPrice = _unitPrice(purchaseData, tokenPrices);

        bool handled = _oraclePricing(purchaseData, tokenPrices, unitPrice);

        emit UnderscoreOraclePricingResult(handled, purchaseData.pricingData, purchaseData.totalPrice);
    }

    function callUnderscoreSetTokenPrices(
        bytes32 sku,
        address[] calldata tokens,
        uint256[] calldata prices
    ) external {
        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage tokenPrices = skuInfo.prices;
        _setTokenPrices(tokenPrices, tokens, prices);
    }

    function _conversionRate(
        address fromToken,
        address toToken,
        bytes memory /*data*/
    ) internal view override returns (uint256 rate) {
        rate = mockConversionRates[fromToken][toToken];
        // solhint-disable-next-line reason-string
        require(rate != 0, "OracleSaleMock: undefined conversion rate");
    }
}
