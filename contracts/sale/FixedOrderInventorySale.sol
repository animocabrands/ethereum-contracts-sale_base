// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./FixedPricesSale.sol";

/**
 * @title FixedOrderInventorySale
 * A FixedPricesSale contract that handles the purchase of NFTs of an inventory contract to a
 * receipient. The provisioning of the NFTs occurs in a sequential order defined by a token list.
 * Only a single SKU is supported.
 */
contract FixedOrderInventorySale is FixedPricesSale {
    address public immutable inventory;

    uint256 public tokenIndex;

    uint256[] public tokenList;

    /**
     * Constructor.
     * @dev Reverts if `inventory_` is the zero address.
     * @dev Emits the `MagicValues` event.
     * @dev Emits the `Paused` event.
     * @param inventory_ The inventory contract from which the NFT sale supply is attributed from.
     * @param payoutWallet The payout wallet.
     * @param tokensPerSkuCapacity the cap for the number of tokens managed per SKU.
     */
    constructor(
        address inventory_,
        address payoutWallet,
        uint256 tokensPerSkuCapacity
    )
        public
        FixedPricesSale(
            payoutWallet,
            1, // single SKU
            tokensPerSkuCapacity
        )
    {
        // solhint-disable-next-line reason-string
        require(inventory_ != address(0), "FixedOrderInventorySale: zero address inventory");

        inventory = inventory_;
    }

    /**
     * Adds additional tokens to the sale supply.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if `tokens` is empty.
     * @dev Reverts if any of `tokens` are zero.
     * @dev The list of tokens specified (in sequence) will be appended to the end of the ordered
     *  sale supply list.
     * @param tokens The list of tokens to add.
     */
    function addSupply(uint256[] memory tokens) public virtual onlyOwner {
        uint256 numTokens = tokens.length;

        // solhint-disable-next-line reason-string
        require(numTokens != 0, "FixedOrderInventorySale: empty tokens to add");

        for (uint256 i = 0; i != numTokens; ++i) {
            uint256 token = tokens[i];

            // solhint-disable-next-line reason-string
            require(token != 0, "FixedOrderInventorySale: adding zero token");

            tokenList.push(token);
        }

        if (_skus.length() != 0) {
            bytes32 sku = _skus.at(0);
            SkuInfo storage skuInfo = _skuInfos[sku];
            skuInfo.totalSupply += numTokens;
            skuInfo.remainingSupply += numTokens;
        }
    }

    /**
     * Sets the tokens of the ordered sale supply list.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if called when the contract is not paused.
     * @dev Reverts if the sale supply is empty.
     * @dev Reverts if the lengths of `indexes` and `tokens` do not match.
     * @dev Reverts if `indexes` is zero length.
     * @dev Reverts if any of `indexes` are less than `tokenIndex`.
     * @dev Reverts if any of `indexes` are out-of-bounds.
     * @dev Reverts it `tokens` is zero length.
     * @dev Reverts if any of `tokens` are zero.
     * @dev Does not allow resizing of the sale supply, only the re-ordering or replacment of
     *  existing tokens.
     * @dev Because the elements of `indexes` and `tokens` are processed in sequence, duplicate
     *  entries in either array are permitted, which allows for ordered operations to be performed
     *  on the ordered sale supply list in the same transaction.
     * @param indexes The list of indexes in the ordered sale supply list whose element values
     *  will be set.
     * @param tokens The new tokens to set in the ordered sale supply list at the corresponding
     *  positions provided by `indexes`.
     */
    function setSupply(uint256[] memory indexes, uint256[] memory tokens) public virtual onlyOwner whenPaused {
        uint256 tokenListLength = tokenList.length;

        // solhint-disable-next-line reason-string
        require(tokenListLength != 0, "FixedOrderInventorySale: empty token list");

        uint256 numIndexes = indexes.length;

        // solhint-disable-next-line reason-string
        require(numIndexes != 0, "FixedOrderInventorySale: empty indexes");

        uint256 numTokens = tokens.length;

        // solhint-disable-next-line reason-string
        require(numIndexes == numTokens, "FixedOrderInventorySale: array length mismatch");

        uint256 tokenIndex_ = tokenIndex;

        for (uint256 i = 0; i != numIndexes; ++i) {
            uint256 index = indexes[i];

            // solhint-disable-next-line reason-string
            require(index >= tokenIndex_, "FixedOrderInventorySale: invalid index");

            // solhint-disable-next-line reason-string
            require(index < tokenListLength, "FixedOrderInventorySale: index out-of-bounds");

            uint256 token = tokens[i];

            // solhint-disable-next-line reason-string
            require(token != 0, "FixedOrderInventorySale: zero token");

            tokenList[index] = token;
        }
    }

    /**
     * Retrieves the amount of total sale supply.
     * @return The amount of total sale supply.
     */
    function getTotalSupply() public view virtual returns (uint256) {
        return tokenList.length;
    }

    /**
     * Lifecycle step which delivers the purchased SKUs to the recipient.
     * @dev Responsibilities:
     *  - Ensure the product is delivered to the recipient, if that is the contract's responsibility.
     *  - Handle any internal logic related to the delivery, including the remaining supply update.
     *  - Add any relevant extra data related to delivery in `purchase.deliveryData` and document how to interpret it.
     * @dev Reverts if there is not enough available supply.
     * @dev Updates `purchase.deliveryData` with the list of tokens allocated from `tokenList` for
     *  this purchase.
     * @param purchase The purchase conditions.
     */
    function _delivery(PurchaseData memory purchase) internal virtual override {
        super._delivery(purchase);

        purchase.deliveryData = new bytes32[](purchase.quantity);

        uint256 tokenCount = 0;
        uint256 tokenIndex_ = tokenIndex;

        while (tokenCount != purchase.quantity) {
            purchase.deliveryData[tokenCount] = bytes32(tokenList[tokenIndex_]);
            ++tokenCount;
            ++tokenIndex_;
        }

        tokenIndex = tokenIndex_;
    }
}
