// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../sale/payment/interfaces/IUniswapV2Router.sol";
import "../../sale/payment/UniswapV2Adapter.sol";
import "../../sale/UniswapSwapSale.sol";

contract UniswapSwapSaleMock is UniswapSwapSale {

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken,
        IUniswapV2Router uniswapV2Router
    )
        public
        UniswapSwapSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken,
            uniswapV2Router
        )
    {}

    function callUnderscoreValidation(
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

        _validation(purchaseData);
    }

    function callUnderscorePricing(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view returns (
        uint256 totalPrice,
        bytes32[] memory pricingData
    ) {
        PurchaseData memory purchaseData;
        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;

        _pricing(purchaseData);

        totalPrice = purchaseData.totalPrice;
        pricingData = purchaseData.pricingData;
    }

    function callUnderscorePayment(
        address payable recipient,
        address token,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData,
        uint256 totalPrice,
        bytes32[] calldata pricingData
    ) external payable {
        PurchaseData memory purchaseData;
        purchaseData.purchaser = _msgSender();
        purchaseData.recipient = recipient;
        purchaseData.token = token;
        purchaseData.sku = sku;
        purchaseData.quantity = quantity;
        purchaseData.userData = userData;
        purchaseData.totalPrice = totalPrice;
        purchaseData.pricingData = pricingData;

        _payment(purchaseData);
    }

    function callUnderscoreEstimateSwap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes calldata data
    ) external view returns (
        uint256 fromAmount
    ) {
        fromAmount = _estimateSwap(fromToken, toToken, toAmount, data);
    }

    function callUnderscoreSwap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes calldata data
    ) external returns (
        uint256 fromAmount
    ) {
        fromAmount = _swap(fromToken, toToken, toAmount, data);
    }

    function jpdebug(bytes calldata data) external pure returns (bytes memory result, uint256 length, uint256 answer) {
        result = data;
        length = data.length;

        assembly { answer := mload(add(result, 32)) }
    }

}
