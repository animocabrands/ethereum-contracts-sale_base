// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../oracle/interfaces/IUniswapV2Router.sol";
import "../oracle/UniswapV2Adapter.sol";
import "./abstract/SwapSale.sol";

/**
 * @title UniswapSwapSale
 * An SwapSale which implements a UniswapV2-based token conversion pricing strategy. The final
 *  implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a non-zero length array indicates Uniswap-based pricing, otherwise indicates fixed pricing.
 *  - [0] uint256: the token conversion rate used for Uniswap-based pricing.
 *
 * PurchaseData.userData MUST be encoded as follow:
 *  - [0] uint256: the maximum amount of purchase tokens to swap for reference tokens, in payment
 *    for a purchase. A value of 0 will use the maximum supported amount (default: type(uint256).max).
 *  - [1] uint256: the token swap deadline as a UNIX timestamp. A value of 0 will not apply any
 *    deadline.
 */
contract UniswapSwapSale is SwapSale, UniswapV2Adapter {
    using SafeMath for uint256;

    /**
     * Constructor.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param payoutWallet_ The payout wallet.
     * @param skusCapacity The cap for the number of managed SKUs.
     * @param tokensPerSkuCapacity The cap for the number of tokens managed per SKU.
     * @param referenceToken The token to use for oracle-based conversions.
     * @param uniswapV2Router The UniswapV2 router contract used to facilitate operations against the Uniswap network.
     */
    constructor(
        address payoutWallet_,
        uint256 skusCapacity,
        uint256 tokensPerSkuCapacity,
        address referenceToken,
        IUniswapV2Router uniswapV2Router
    )
        public
        SwapSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
        UniswapV2Adapter(
            uniswapV2Router
        )
    {}

    /**
     * Receives refunded ETH from the Uniswap token swapping operation.
     * @dev Reverts if the sender of ETH isn't the Uniswap V2 router.
     */
    receive() external payable {
        require(
            _msgSender() == address(uniswapV2Router),
            "UniswapSwapSale: Invalid ETH sender");
    }

    /*                               Internal Life Cycle Functions                               */

    /**
     * Lifecycle step which validates the purchase pre-conditions.
     * @dev Responsibilities:
     *  - Ensure that the purchase pre-conditions are met and revert if not.
     * @param purchase The purchase conditions.
     */
    function _validation(
        PurchaseData memory purchase
    ) internal virtual override view {
        super._validation(purchase);
        require(
            purchase.userData.length >= 64,
            "UniswapSwapSale: Missing expected purchase user data");
    }

    /**
     * Lifecycle step which manages the transfer of funds from the purchaser.
     * @dev Responsibilities:
     *  - Ensure the payment reaches destination in the expected output token;
     *  - Handle any token swap logic;
     *  - Add any relevant extra data related to payment in `purchase.paymentData` and document how to interpret it.
     * @dev Reverts in case of payment failure.
     * @param purchase The purchase conditions.
     */
    function _payment(
        PurchaseData memory purchase
    ) internal virtual override {
        if ((purchase.pricingData.length != 0) && (purchase.token != TOKEN_ETH)) {
            bytes memory data = purchase.userData;
            uint256 maxFromAmount;

            assembly { maxFromAmount := mload(add(data, 32)) }

            if (maxFromAmount == 0) {
                maxFromAmount = type(uint256).max;
            }

            require(
                IERC20(purchase.token).approve(address(uniswapV2Router), maxFromAmount),
                "UniswapSwapSale: ERC20 payment approval failed");
        }
        super._payment(purchase);
    }

    /*                               Internal Utility Functions                                  */

    /**
     * Retrieves the conversion rate for the `fromToken`/`toToken` pair via the oracle.
     * @dev Reverts if the oracle does not provide a conversion rate for the pair.
     * @param fromToken The source token from which the conversion rate is derived from.
     * @param toToken the destination token from which the conversion rate is derived from.
     * @param *data* Additional data with no specified format for deriving the conversion rate.
     * @return rate The conversion rate for the `fromToken`/`toToken` pair, retrieved via the oracle.
     */
    function _conversionRate(
        address fromToken,
        address toToken,
        bytes memory /*data*/
    ) internal virtual override view returns (uint256 rate) {
        if (fromToken == TOKEN_ETH) {
            fromToken = uniswapV2Router.WETH();
        }

        if (toToken == TOKEN_ETH) {
            toToken = uniswapV2Router.WETH();
        }

        (uint256 fromReserve, uint256 toReserve) = _getReserves(fromToken, toToken);
        rate = toReserve.mul(10 ** 18).div(fromReserve);
    }

    /**
     * Estimates the optimal amount of `fromToken` to provide in order to swap for the specified amount of
     *  `toToken`, via the oracle.
     * @dev Reverts if the oracle cannot estimate the optimal amount of `fromToken` to provide.
     * @param fromToken The source token to swap from.
     * @param toToken The destination token to swap to.
     * @param toAmount The amount of destination tokens to swap for.
     * @param *data* Additional data with no specified format for deriving the swap estimate.
     * @return fromAmount The estimated optimal amount of `fromToken` to provide in order to perform a swap,
     *  via the oracle.
     */
    function _estimateSwap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes memory /*data*/
    ) internal virtual override view returns (
        uint256 fromAmount
    ) {
        if (fromToken == TOKEN_ETH) {
            fromToken = uniswapV2Router.WETH();
        }

        if (toToken == TOKEN_ETH) {
            toToken = uniswapV2Router.WETH();
        }

        fromAmount = _getAmountsIn(fromToken, toToken, toAmount);
    }

    /**
     * Swaps `fromToken` for the specified amount of `toToken`, via the oracle.
     * @dev Reverts if the oracle is unable to perform the token swap.
     * @param fromToken The source token to swap from.
     * @param toToken The destination token to swap to.
     * @param toAmount The amount of destination tokens to swap for.
     * @param data Additional data for UniswapV2 (uint256 `maxFromAmount`, uint256 `deadline`).
     * @return fromAmount The amount of `fromToken` swapped for the specified amount of `toToken`, via the
     *  oracle.
     */
    function _swap(
        address fromToken,
        address toToken,
        uint256 toAmount,
        bytes memory data
    ) internal virtual override returns (
        uint256 fromAmount
    ) {
        uint256 maxFromAmount;
        uint256 deadline;

        assembly {
            maxFromAmount := mload(add(data, 32))
            deadline := mload(add(data, 64))
        }

        if (maxFromAmount == 0) {
            if (fromToken == TOKEN_ETH) {
                maxFromAmount = msg.value;
            } else {
                maxFromAmount = type(uint256).max;
            }
        }

        if (deadline == 0) {
            deadline = type(uint256).max;
        }

        if (fromToken == TOKEN_ETH) {
            fromToken = uniswapV2Router.WETH();
        }

        if (toToken == TOKEN_ETH) {
            toToken = uniswapV2Router.WETH();
        }

        fromAmount = _swapTokensForExactAmount(
            fromToken,
            toToken,
            toAmount,
            maxFromAmount,
            address(this),
            deadline);
    }
}
