// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "../../sale/SimpleSale.sol";

contract SimpleSaleMock is SimpleSale {

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
        Price storage price = prices[_stringToBytes32(purchaseId)];
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
        extData[0] = _stringToBytes32(data);

        _purchase(
            purchaser,
            _stringToBytes32(purchaseId),
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
            _bytes32ToString(purchase.sku),
            purchase.quantity,
            purchase.paymentToken,
            uint256(priceInfo[0]),
            uint256(priceInfo[1]),
            _bytes32ToString(purchase.extData[0]));
    }

    /**
     * Converts a string into bytes32.
     * @dev Input string must not be longer than 32 8-bit characters in order to
     *  prevent a lossy result.
     * @param inputString Input string to convert.
     * @return outputBytes32 Bytes32 converted result.
     */
    function _stringToBytes32(
        string memory inputString
    ) public pure returns (bytes32 outputBytes32) {
        bytes memory inputBytes = bytes(inputString);

        if (inputBytes.length == 0) {
            return 0x0;
        }

        assembly {
            outputBytes32 := mload(add(inputString, 32))
        }
    }

    /**
     * Converts a bytes32 into a string.
     * @param inputBytes32 Input bytes32 to convert.
     * @return outputString String converted result.
     */
    function _bytes32ToString(
        bytes32 inputBytes32
    ) public pure returns (string memory outputString) {
        bytes memory bytesString = new bytes(32);
        uint256 charCount = 0;

        for (uint256 index = 0; index < 32; ++index) {
            byte char = byte(bytes32(uint256(inputBytes32) * 2 ** (8 * index)));

            if (char != 0) {
                bytesString[charCount] = char;
                charCount++;
            }
        }

        bytes memory bytesStringTrimmed = new bytes(charCount);

        for (uint256 index = 0; index < charCount; ++index) {
            bytesStringTrimmed[index] = bytesString[index];
        }

        outputString = string(bytesStringTrimmed);
    }

}
