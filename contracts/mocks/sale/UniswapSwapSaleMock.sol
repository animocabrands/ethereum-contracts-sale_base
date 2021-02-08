// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../oracle/interfaces/IUniswapV2Router.sol";
import "../../oracle/UniswapV2Adapter.sol";
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

    function createSku(
        bytes32 sku,
        uint256 totalSupply,
        uint256 maxQuantityPerPurchase,
        address notificationsReceiver
    ) external {
        _createSku(sku, totalSupply, maxQuantityPerPurchase, notificationsReceiver);
    }

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
        uint256 fromAmount,
        address toToken,
        uint256 toAmount,
        bytes calldata data
    ) external payable {
        if (fromToken != TOKEN_ETH) {
            require(
                IERC20(fromToken).approve(address(uniswapV2Router), fromAmount),
                "UniswapSwapSaleMock: ERC20 swap approval failed");

            require(
                IERC20(fromToken).allowance(msg.sender, address(this)) >= fromAmount,
                "UniswapSwapSaleMock: ERC20 allowance insufficient");

            require(
                IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount),
                "UniswapSwapSaleMock: ERC20 transfer from failed");
        }
        fromAmount = _swap(fromToken, toToken, toAmount, data);
        emit UnderscoreSwapResult(fromAmount);
    }

    function getReserves(
        address tokenA,
        address tokenB
    ) external view returns (
        uint256 reserveA,
        uint256 reserveB
    ) {
        if (tokenA == TOKEN_ETH) {
            tokenA = uniswapV2Router.WETH();
        }

        if (tokenB == TOKEN_ETH) {
            tokenB = uniswapV2Router.WETH();
        }

        (reserveA, reserveB) = _getReserves(tokenA, tokenB);
    }

}
