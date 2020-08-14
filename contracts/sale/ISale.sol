// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

/**
 * @title ISale
 * An interface contract which defines the events and public API for a sale
 * contract.
 */
interface ISale {

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
     * Retrieves the list of inventory SKUs available for purchase.
     * @return skus The list of inventory SKUs available for purchase.
     */
    function getSkus(
    ) external view returns (
        bytes32[] memory skus
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
     * @return priceInfo Implementation-specific calculated total price
     *  information.
     */
    function getPrice(
        address payable purchaser,
        IERC20 paymentToken,
        bytes32 sku,
        uint256 quantity,
        bytes calldata userData
    ) external view returns (
        uint256 price,
        bytes32[] memory priceInfo
    );

}
