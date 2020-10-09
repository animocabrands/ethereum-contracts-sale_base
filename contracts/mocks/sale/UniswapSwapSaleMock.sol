// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../sale/oracle/interfaces/IUniswapV2Router.sol";
import "../../sale/oracle/UniswapV2Adapter.sol";
import "../../sale/UniswapSwapSale.sol";

contract UniswapSwapSaleMock is UniswapSwapSale {

    event UnderscoreSwapResult(uint256 fromAmount);

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

    function addEth() external payable {}

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

    function callUnderscoreConversionRate(
        address fromToken,
        address toToken,
        bytes calldata data
    ) external view returns (
        uint256 rate
    ) {
        rate = _conversionRate(fromToken, toToken, data);
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
    ) external payable {
        uint256 fromAmount = _swap(fromToken, toToken, toAmount, data);
        emit UnderscoreSwapResult(fromAmount);
    }

}
