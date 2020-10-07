// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "./payment/interfaces/IUniswapV2Router.sol";
import "./payment/UniswapV2Adapter.sol";
import "./OracleSwapSale.sol";

/**
 * @title UniswapConversionSale
 * An OracleConversionSale which implements a Uniswap-based token conversion pricing strategy. The final
 *  implementer is responsible for implementing any additional pricing and/or delivery logic.
 *
 * PurchaseData.pricingData:
 *  - a non-zero length array indicates Uniswap-based pricing, otherwise indicates fixed pricing.
 *  - [0] uint256: the token conversion rate used for Uniswap-based pricing.
 *
 * PurchaseData.userData:
 *  - [0] uint256: the maximum amount of purchase tokens to swap for reference tokens, in payment for a
 *    purchase. A value of 0 will use the maximum supported amount (default: type(uint256).max).
 *  - [1] uint256: the overriding value to use for the swap deadline duration. A value of 0 will use the
 *    value returned by SWAP_DEADLINE_DURATION_SECONDS (default: 300 seconds)
 */
contract UniswapSwapSale is OracleSwapSale, UniswapV2Adapter {
    using SafeMath for uint256;

    uint256 public constant SWAP_DEADLINE_DURATION_SECONDS = 300;

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
        OracleSwapSale(
            payoutWallet_,
            skusCapacity,
            tokensPerSkuCapacity,
            referenceToken
        )
        UniswapV2Adapter(
            uniswapV2Router
        )
    {}

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
     * @param data Additional data with no specified format for performing the swap.
     * return fromAmount The amount of `fromToken` swapped for the specified amount of `toToken`, via the
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
        if (fromToken == TOKEN_ETH) {
            fromToken = uniswapV2Router.WETH();
        }

        if (toToken == TOKEN_ETH) {
            toToken = uniswapV2Router.WETH();
        }

        uint256 maxFromAmount;
        uint256 deadlineDuration;

        assembly {
            maxFromAmount := mload(add(data, 32))
            deadlineDuration := mload(add(data, 64))
        }

        if (maxFromAmount == 0) {
            maxFromAmount = type(uint256).max;
        }

        if (deadlineDuration == 0) {
            deadlineDuration = SWAP_DEADLINE_DURATION_SECONDS;
        }

        uint256 deadline = block.timestamp.add(deadlineDuration);

        fromAmount = _swapTokensForExactAmount(
            fromToken,
            toToken,
            toAmount,
            maxFromAmount,
            address(this),
            deadline);
    }
}
