// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        SimpleSale(
            payoutWallet_,
            payoutToken_
        )
        public
    {}

    /**
     * Retrieves the associated ETH and ERC20 token prices for the given
     * purchase ID.
     * @param sku The SKU of the item whose price will be retrieved.
     * @return ethPrice The associated ETH price for the given purchase ID.
     * @return erc20Price The associated ERC20 token price for the given
     *  purchase ID.
     */
    function getPrice(
        bytes32 sku
    ) external view returns (uint256 ethPrice, uint256 erc20Price) {
        Price storage price = prices[sku];
        ethPrice = price.ethPrice;
        erc20Price = price.erc20Price;
    }

    /**
     * Retrieves implementation-specific extra data passed as the Purchased
     *  event extData argument.
     * @param *purchase* Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param *paymentInfo* Implementation-specific accepted purchase payment
     *  information.
     * @param *deliveryInfo* Implementation-specific purchase delivery
     *  information.
     * @param *finalizeInfo* Implementation-specific purchase finalization
     *  information.
     * @return extData Implementation-specific extra data passed as the Purchased event
     *  extData argument (0:total price, 1:unit price, 2:purchase data).
     */
    function _getPurchasedEventExtData(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */,
        bytes32[] memory /* finalizeInfo */
    ) internal override virtual view returns (bytes32[] memory extData) {
        extData = new bytes32[](3);
        extData[0] = priceInfo[0];
        extData[1] = priceInfo[1];
        extData[2] = purchase.extData[0];
    }

}