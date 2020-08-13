// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

/**
 * @title ISale
 * An interface contract which defines the events and public API for a sale
 * contract.
 */
interface ISale {

    event SkusAdded(
        bytes32[] skus,
        bool[] added
    );

    event PaymentTokensAdded(
        IERC20[] tokens,
        bool[] added
    );

    event SkuTokenPricesUpdated(
        bytes32 sku,
        IERC20[] tokens,
        uint256[] prices,
        uint256[] prevPrices
    );

    event Purchased(
        address indexed purchaser,
        address operator,
        IERC20 paymentToken,
        bytes32 indexed sku,
        uint256 indexed quantity,
        bytes userData,
        bytes32[] purchaseData
    );

    /**
     * Adds a list of inventory SKUs to make available for purchase.
     * @dev Emits the SkusAdded event.
     * @param skus List of inventory SKUs to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding inventory SKU has been added.
     */
    function addSkus(
        bytes32[] calldata skus
    ) external returns (
        bool[] memory added
    );

    /**
     * Retrieves the list of inventory SKUs available for purchase.
     * @return skus The list of inventory SKUs available for purchase.
     */
    function getSkus(
    ) external view returns (
        bytes32[] memory skus
    );

    /**
     * Adds a list of ERC20 tokens to add to the supported list of payment
     * tokens.
     * @dev Emits the PaymentTokensAdded event.
     * @param tokens List of ERC20 tokens to add.
     * @return added List of state flags indicating whether or not the
     *  corresponding ERC20 token has been added.
     */
    function addPaymentTokens(
        IERC20[] calldata tokens
    ) external returns (
        bool[] memory added
    );

    /**
     * Retrieves the list of supported ERC20 payment tokens.
     * @return tokens The list of supported ERC20 payment tokens.
     */
    function getPaymentTokens(
    ) external view returns (
        IERC20[] memory tokens
    );

    /**
     * Sets the token prices for the specified inventory SKU.
     * @dev Emits the SkuTokenPricesUpdated event.
     * @dev Reverts if the specified SKU does not exist.
     * @dev Reverts if the token/price list lengths are not aligned.
     * @dev Reverts if any of the specified ERC20 tokens are unsupported.
     * @param sku The SKU whose token prices will be set.
     * @param tokens The list of SKU payout tokens to set the price for.
     * @param prices The list of SKU token prices to set with.
     * @return prevPrices The list of sku token prices before the update.
     */
    function setSkuTokenPrices(
        bytes32 sku,
        IERC20[] calldata tokens,
        uint256[] calldata prices
    ) external returns (
        uint256[] memory prevPrices
    );

    /**
     * Retrieves the undiscounted unit price of the given inventory SKU item, in
     * the specified supported ERC20 payment token currency.
     * @param sku The inventory SKU item whose undiscounted unit price will be
     *  retrieved.
     * @param token The ERC20 token currency of the retrieved price.
     * @return price The undiscounted unit price of the given inventory SKU item, in
     *  the specified supported ERC20 payment token currency.
     */
    function getSkuTokenPrice(
        bytes32 sku,
        IERC20 token
    ) external view returns (
        uint256 price
    );

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event.
     * @param purchaser The initiating account making the purchase.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     * @param sku The SKU of the item being purchased.
     * @param quantity The quantity of SKU items being purchased.
     *  purchase.
     * @param userData Implementation-specific extra user data.
     */
    function purchaseFor(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external payable;

    /**
     * Calculates the total price amount for the given quantity of the specified
     *  SKU item.
     * @param purchaser The account for whome the queried total price amount is
     *  for.
     * @param paymentToken The ERC20 token payment currency of the calculated
     *  total price amount.
     * @param sku The SKU item whose unit price is used to calculate the total
     *  price amount.
     * @param quantity The quantity of SKU items used to calculate the total
     *  price amount.
     * @param userData Implementation-specific extra user data.
     * @return price The calculated total price amount for the given quantity of
     *  the specified SKU item.
     */
    function getPrice(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view returns (
        uint256 price
    );

}
