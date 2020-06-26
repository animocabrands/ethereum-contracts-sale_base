// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-core_library/contracts/utils/types/Bytes32ToString.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/types/StringToBytes32.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

    using Bytes32ToString for bytes32;
    using StringToBytes32 for string;

    event Purchased(
        address indexed purchaser,
        address operator,
        string indexed purchaseId,
        uint256 indexed quantity,
        IERC20 paymentToken,
        uint256 totalPrice,
        uint256 unitPrice,
        string data
    );

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
     * @param purchaseId The item purchase ID whose price will be retrieved.
     * @return ethPrice The associated ETH price for the given purchase ID.
     * @return erc20Price The associated ERC20 token price for the given
     *  purchase ID.
     */
    function getPrice(
        string calldata purchaseId
    ) external view returns (uint256 ethPrice, uint256 erc20Price) {
        Price storage price = prices[purchaseId.toBytes32()];
        ethPrice = price.ethPrice;
        erc20Price = price.erc20Price;
    }

    /**
     * Performs a purchase based on the given purchase conditions.
     * @dev Emits the Purchased event when the function is called successfully.
     * @param purchaser The initiating account making the purchase.
     * @param purchaseId The purchase identifier of the item being purchased.
     * @param quantity The quantity of items being purchased.
     * @param paymentToken The ERC20 token to use as the payment currency of the
     *  purchase.
     * @param data String data associated with the purchase.
     */
    function purchaseFor(
        address payable purchaser,
        string calldata purchaseId,
        uint256 quantity,
        IERC20 paymentToken,
        string calldata data
    ) external payable {
        bytes32[] memory extData = new bytes32[](1);
        extData[0] = data.toBytes32();

        _purchase(
            purchaser,
            purchaseId.toBytes32(),
            quantity,
            paymentToken,
            _msgSender(),
            msg.value,
            _msgData(),
            extData);
    }

    /**
     * Triggers a notification(s) that the purchase has been complete.
     * @dev Emits the Purchased event when the function is called successfully.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param *paymentInfo* Implementation-specific accepted purchase payment
     *  information.
     * @param *deliveryInfo* Implementation-specific purchase delivery
     *  information.
     * @param *finalizeInfo* Implementation-specific purchase finalization
     *  information.
     */
    function _notifyPurchased(
        Purchase memory purchase,
        bytes32[] memory priceInfo,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */,
        bytes32[] memory /* finalizeInfo */
    ) internal override {
        emit Purchased(
            purchase.purchaser,
            purchase.msgSender,
            purchase.sku.toString(),
            purchase.quantity,
            purchase.paymentToken,
            uint256(priceInfo[0]),
            uint256(priceInfo[1]),
            purchase.extData[0].toString());
    }

}
