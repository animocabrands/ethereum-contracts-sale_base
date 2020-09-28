// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../sale/payment/interfaces/IUniswapV2Router.sol";
import "../../sale/OracleSale.sol";
import "../../sale/payment/UniswapV2Adapter.sol";

contract OracleSaleMock is OracleSale, UniswapV2Adapter {
    using SafeMath for uint256;

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken,
        IUniswapV2Router uniswapV2Router
    )
        public
        OracleSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
        UniswapV2Adapter(
            uniswapV2Router
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
        require(
            tokenPrices.length() == 0 || tokenPrices.contains(bytes32(uint256(_referenceToken))),
            "OracleSale: missing reference token"
        );
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
        PurchaseData memory purchaseData = _getPurchaseData(
            recipient,
            token,
            sku,
            quantity,
            userData,
            totalPrice,
            pricingData,
            paymentData,
            deliveryData);

        SkuInfo storage skuInfo = _skuInfos[sku];
        EnumMap.Map storage prices = skuInfo.prices;

        unitPrice = _unitPrice(purchaseData, prices);
    }

    function _conversionRate(
        address tokenA,
        address tokenB
    ) internal override (OracleSale, UniswapV2Adapter) view returns (uint256 rate) {
        (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);
        return reserveB.mul(10 ** 18).div(reserveA);
    }

    function _getPurchaseData(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes memory userData,
        uint256 totalPrice,
        bytes32[] memory pricingData,
        bytes32[] memory paymentData,
        bytes32[] memory deliveryData
    ) internal view returns (PurchaseData memory purchase) {
        purchase.purchaser = _msgSender();
        purchase.recipient = recipient;
        purchase.token = token;
        purchase.sku = sku;
        purchase.quantity = quantity;
        purchase.userData = userData;
        purchase.totalPrice = totalPrice;
        purchase.pricingData = pricingData;
        purchase.paymentData = paymentData;
        purchase.deliveryData = deliveryData;
    }

}
