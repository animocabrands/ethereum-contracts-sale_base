// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./Sale.sol";

/**
 * @title FixedSupplyLotSale
 * An abstract sale contract for fixed supply lots, where each instance of a lot
 * is composed of a non-fungible token and some quantity of a fungible token.
 */
abstract contract FixedSupplyLotSale is Sale {

    // a Lot is a class of purchasable sale items.
    struct Lot {
        uint256[] nonFungibleSupply; // supply of non-fungible tokens for sale.
        uint256 fungibleAmount; // fungible token amount bundled with each NFT.
        uint256 numAvailable; // number of Lot items available for purchase.
    }

    event LotCreated (
        uint256 lotId, // id of the created Lot.
        uint256[] nonFungibleTokens, // initial Lot supply of non-fungible tokens.
        uint256 fungibleAmount // initial fungible token amount bundled with each NFT.
    );

    event LotNonFungibleSupplyUpdated (
        uint256 lotId, // id of the Lot whose supply of non-fungible tokens was updated.
        uint256[] nonFungibleTokens // the non-fungible tokens that updated the supply.
    );

    event LotFungibleAmountUpdated (
        uint256 lotId, // id of the Lot whose fungible token amount was updated.
        uint256 fungibleAmount // updated fungible token amount.
    );

    uint256 public _fungibleTokenId; // inventory token id of the fungible tokens bundled in a Lot item.

    address public _inventoryContract; // inventory contract address.

    mapping (uint256 => Lot) public _lots; // mapping of lotId => Lot.

    /**
     * Constructor.
     * @param fungibleTokenId Inventory token id of the fungible tokens bundled in a Lot item.
     * @param inventoryContract Address of the inventory contract to use in the delivery of purchased Lot items.
     */
    constructor(
        uint256 fungibleTokenId,
        address inventoryContract
    )
        Sale()
        internal
    {
        setFungibleTokenId(fungibleTokenId);
        setInventoryContract(inventoryContract);
    }

    /**
     * Sets the inventory token id of the fungible tokens bundled in a Lot item.
     * @dev Reverts if `fungibleTokenId` is zero.
     * @dev Reverts if setting `fungibleTokenId` with the current value.
     * @param fungibleTokenId Inventory token id of the fungible tokens to bundle in a Lot item.
     */
    function setFungibleTokenId(
        uint256 fungibleTokenId
    )
        public
        onlyOwner
        whenNotStarted
    {
        require(fungibleTokenId != 0, "FixedSupplyLotSale: zero fungible token ID");
        require(fungibleTokenId != _fungibleTokenId, "FixedSupplyLotSale: duplicate assignment");

        _fungibleTokenId = fungibleTokenId;
    }

    /**
     * Sets the inventory contract to use in the delivery of purchased Lot items.
     * @dev Reverts if `inventoryContract` is zero.
     * @dev Reverts if setting `inventoryContract` with the current value.
     * @param inventoryContract Address of the inventory contract to use.
     */
    function setInventoryContract(
        address inventoryContract
    )
        public
        onlyOwner
        whenNotStarted
    {
        require(inventoryContract != address(0), "FixedSupplyLotSale: zero inventory contract");
        require(inventoryContract != _inventoryContract, "FixedSupplyLotSale: duplicate assignment");

        _inventoryContract = inventoryContract;
    }

    /**
     * Creates a new Lot to add to the sale.
     * @dev Reverts if the lot to create already exists.
     * @dev There are NO guarantees about the uniqueness of the non-fungible token supply.
     * @param lotId Id of the Lot to create.
     * @param nonFungibleSupply Initial non-fungible token supply of the Lot.
     * @param fungibleAmount Initial fungible token amount to bundle with each NFT.
     */
    function createLot(
        uint256 lotId,
        uint256[] memory nonFungibleSupply,
        uint256 fungibleAmount
    )
        public
        onlyOwner
        whenNotStarted
    {
        bytes32 sku = bytes32(lotId);

        require(!_hasSku(sku), "FixedSupplyLotSale: lot exists");

        bytes32[] memory inventorySkus = new bytes32[](1);
        inventorySkus[0] = sku;

        _addSkus(inventorySkus);

        Lot memory lot;
        lot.nonFungibleSupply = nonFungibleSupply;
        lot.fungibleAmount = fungibleAmount;
        lot.numAvailable = nonFungibleSupply.length;

        _lots[lotId] = lot;

        emit LotCreated(lotId, nonFungibleSupply, fungibleAmount);
    }

    /**
     * Updates the given Lot's non-fungible token supply with additional NFTs.
     * @dev Reverts if `nonFungibleTokens` is an empty array.
     * @dev Reverts if the lot whose non-fungible supply is being updated does not exist.
     * @dev There are NO guarantees about the uniqueness of the non-fungible token supply.
     * @param lotId Id of the Lot to update.
     * @param nonFungibleTokens Non-fungible tokens to update with.
     */
    function updateLotNonFungibleSupply(
        uint256 lotId,
        uint256[] calldata nonFungibleTokens
    )
        external
        onlyOwner
        whenNotStarted
    {
        require(nonFungibleTokens.length != 0, "FixedSupplyLotSale: zero length non-fungible supply");

        bytes32 sku = bytes32(lotId);

        require(_hasSku(sku), "FixedSupplyLotSale: non-existent lot");

        Lot memory lot = _lots[lotId];

        uint256 newSupplySize = lot.nonFungibleSupply.length.add(nonFungibleTokens.length);
        uint256[] memory newNonFungibleSupply = new uint256[](newSupplySize);

        for (uint256 index = 0; index < lot.nonFungibleSupply.length; index++) {
            newNonFungibleSupply[index] = lot.nonFungibleSupply[index];
        }

        for (uint256 index = 0; index < nonFungibleTokens.length; index++) {
            uint256 offset = index.add(lot.nonFungibleSupply.length);
            newNonFungibleSupply[offset] = nonFungibleTokens[index];
        }

        lot.nonFungibleSupply = newNonFungibleSupply;
        lot.numAvailable = lot.numAvailable.add(nonFungibleTokens.length);

        _lots[lotId] = lot;

        emit LotNonFungibleSupplyUpdated(lotId, nonFungibleTokens);
    }

    /**
     * Updates the given Lot's fungible token amount bundled with each NFT.
     * @dev Reverts if the lot whose fungible amount is being updated does not exist.
     * @dev Reverts if setting `fungibleAmount` with the current value.
     * @param lotId Id of the Lot to update.
     * @param fungibleAmount Fungible token amount to update with.
     */
    function updateLotFungibleAmount(
        uint256 lotId,
        uint256 fungibleAmount
    )
        external
        onlyOwner
        whenPaused
    {
        bytes32 sku = bytes32(lotId);

        require(_hasSku(sku), "FixedSupplyLotSale: non-existent lot");
        require(_lots[lotId].fungibleAmount != fungibleAmount, "FixedSupplyLotSale: duplicate assignment");

        _lots[lotId].fungibleAmount = fungibleAmount;

        emit LotFungibleAmountUpdated(lotId, fungibleAmount);
    }

    /**
     * Returns the given number of next available non-fungible tokens for the specified Lot.
     * @dev Reverts if the lot being peeked does not exist.
     * @dev If the given number is more than the next available non-fungible tokens, then the remaining available is returned.
     * @param lotId Id of the Lot whose non-fungible supply to peek into.
     * @param count Number of next available non-fungible tokens to peek.
     * @return The given number of next available non-fungible tokens for the specified Lot, otherwise the remaining available non-fungible tokens.
     */
    function peekLotAvailableNonFungibleSupply(
        uint256 lotId,
        uint256 count
    )
        external
        view
        returns
    (
        uint256[] memory
    )
    {
        bytes32 sku = bytes32(lotId);

        require(_hasSku(sku), "FixedSupplyLotSale: non-existent lot");

        Lot memory lot = _lots[lotId];

        if (count > lot.numAvailable) {
            count = lot.numAvailable;
        }

        uint256[] memory nonFungibleTokens = new uint256[](count);

        uint256 nonFungibleSupplyOffset = lot.nonFungibleSupply.length.sub(lot.numAvailable);

        for (uint256 index = 0; index < count; index++) {
            uint256 position = nonFungibleSupplyOffset.add(index);
            nonFungibleTokens[index] = lot.nonFungibleSupply[position];
        }

        return nonFungibleTokens;
    }

    /**
     * Validates a purchase.
     * @dev Reverts if the purchaser is the zero address.
     * @dev Reverts if the purchaser is the sale contract address.
     * @dev Reverts if the quantity being purchased is zero.
     * @dev Reverts if the payment token is the zero address.
     * @dev Reverts if the lot being purchased does not exist.
     * @dev Reverts if the lot being purchased has an insufficient token supply.
     * @param purchase Purchase conditions (extData[0]:max token amount,
     *  extData[1]:min conversion rate).
     */
    function _validatePurchase(
        Purchase memory purchase
    ) internal override virtual view {
        uint256 lotId = uint256(purchase.sku);

        require(
            purchase.quantity <= _lots[lotId].numAvailable,
            "FixedSupplyLotSale: insufficient available lot supply");
    }

    /**
     * Delivers the purchased SKU item(s) to the purchaser.
     * @param purchase Purchase conditions.
     * @return deliveryInfo Implementation-specific purchase delivery
     *  information (0:num non-fungible tokens, 1-n:non-fungible tokens,
     *  n+1:total fungible amount).
     */
    function _deliverGoods(
        Purchase memory purchase
    ) internal override virtual returns (bytes32[] memory deliveryInfo) {
        deliveryInfo = new bytes32[](purchase.quantity.add(2));
        deliveryInfo[0] = bytes32(purchase.quantity);

        uint256 lotId = uint256(purchase.sku);
        Lot memory lot = _lots[lotId];

        uint256 offset = lot.nonFungibleSupply.length.sub(lot.numAvailable);
        uint256 index = 0;

        while (index < purchase.quantity) {
            deliveryInfo[++index] = bytes32(lot.nonFungibleSupply[offset++]);
        }

        deliveryInfo[++index] = bytes32(lot.fungibleAmount.mul(purchase.quantity));
    }

    /**
     * Finalizes the completed purchase by performing any remaining purchase
     * housekeeping updates.
     * @param purchase Purchase conditions (extData[0]:max token amount,
     *  extData[1]:min conversion rate).
     * @param *priceInfo* Implementation-specific calculated purchase price
     *  information (0:total price).
     * @param *paymentInfo* Implementation-specific accepted purchase payment
     *  information (0:purchase tokens sent, 1:payout tokens received).
     * @param *deliveryInfo* Implementation-specific purchase delivery
     *  information (0:num non-fungible tokens, 1-n:non-fungible tokens,
     *  n+1:total fungible amount).
     * @return *finalizeInfo* Implementation-specific purchase finalization
     *  information.
     */
    function _finalizePurchase(
        Purchase memory purchase,
        bytes32[] memory /* priceInfo */,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */
    ) internal override virtual returns (bytes32[] memory /* finalizeInfo */) {
        uint256 lotId = uint256(purchase.sku);
        _lots[lotId].numAvailable = _lots[lotId].numAvailable.sub(purchase.quantity);
    }

}
