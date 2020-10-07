// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "../../sale/OracleSwapSale.sol";

contract OracleSwapSaleMock is OracleSwapSale {
    using SafeMath for uint256;
    using SafeCast for int256;

    mapping(address => mapping(address => uint256)) public mockSwapRates;

    int256 public mockSwapVariance;

    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken
    )
        public
        OracleSwapSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
    {}

    function setMockSwapRate(
        address fromToken,
        address toToken,
        uint256 rate
    ) external {
        mockSwapRates[fromToken][toToken] = rate;
    }

    function setMockSwapVariance(
        int256 value
    ) external {
        mockSwapVariance = value;
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

    function _estimateSwap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes memory /*data*/
    ) internal override view returns (
        uint256 fromAmount
    ) {
        uint256 swapRate = mockSwapRates[fromToken][toToken];
        require(swapRate != 0, "OracleSwapSaleMock: undefined swap rate");
        fromAmount = toAmount.mul(10 ** 18).div(swapRate);
    }

    function _swap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes memory data
    ) internal override returns (
        uint256 fromAmount
    ) {
        fromAmount = _estimateSwap(
            fromToken,
            toToken,
            toAmount,
            data);
        fromAmount.add(mockSwapVariance.toUint256());
    }

}
