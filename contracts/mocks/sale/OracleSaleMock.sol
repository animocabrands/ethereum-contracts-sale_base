// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../../sale/OracleSale.sol";

contract OracleSaleMock is OracleSale {

    bool public mockOraclePricingEnabled;

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

    function enableMockOraclePricing(
        bool enabled
    ) external {
        mockOraclePricingEnabled = enabled;
    }

    function callUnderscorePricing(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view {
        PurchaseData memory purchaseData;
        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;

        _pricing(purchaseData);
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

    function _oraclePricing(
        PurchaseData memory purchase,
        EnumMap.Map storage tokenPrices,
        uint256 /*unitPrice*/
    ) internal override view returns (
        bool
    ) {
        if (!mockOraclePricingEnabled) {
            return false;
        }

        uint256 referenceUnitPrice = uint256(tokenPrices.get(bytes32(uint256(referenceToken))));
        purchase.totalPrice = referenceUnitPrice.mul(purchase.quantity);

        return true;
    }

}
