pragma solidity ^0.6.6;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
// import "@openzeppelin/contracts/math/Math.sol";

import "../payment/KyberAdapter.sol";

abstract contract FixedSupplyLotSale is Pausable, KyberAdapter, PayoutWallet {
    using SafeMath for uint256;

    // a Lot is a class of purchasable sale items.
    struct Lot {
        bool exists; // state flag to indicate that the Lot item exists.
        uint256[] nonFungibleSupply; // supply of non-fungible tokens for sale.
        uint256 fungibleAmount; // fungible token amount bundled with each NFT.
        uint256 price; // Lot item price, in payout currency tokens.
        uint256 numAvailable; // number of Lot items available for purchase.
    }

    // a struct container for allocating intermediate values, used by the purchaseFor()
    // function, onto the stack (as opposed to memory) to help reduce gas cost for
    // calling the function.
    struct PurchaseForVars {
        address payable recipient;
        uint256 lotId;
        uint256 quantity;
        IERC20 tokenAddress;
        uint256 maxTokenAmount;
        uint256 minConversionRate;
        string extData;
        address payable operator;
        Lot lot;
        uint256[] nonFungibleTokens;
        uint256 totalFungibleAmount;
        uint256 totalPrice;
        uint256 totalDiscounts;
        uint256 tokensSent;
        uint256 tokensReceived;
    }

    event Purchased (
        address indexed recipient, // destination account receiving the purchased Lot items.
        address operator, // account that executed the purchase operation.
        uint256 indexed lotId, // Lot id of the purchased items.
        uint256 indexed quantity, // quantity of Lot items purchased.
        uint256[] nonFungibleTokens, // list of Lot item non-fungible tokens in the purchase.
        uint256 totalFungibleAmount, // total amount of Lot item fungible tokens in the purchase.
        uint256 totalPrice, // total price (excluding any discounts) of the purchase, in payout currency tokens.
        uint256 totalDiscounts, // total discounts applied to the total price, in payout currency tokens.
        address tokenAddress, // purchase currency token contract address.
        uint256 tokensSent, // amount of actual purchase tokens spent (to convert to payout tokens) for the purchase.
        uint256 tokensReceived, // amount of actual payout tokens received (converted from purchase tokens) for the purchase.
        string extData // string encoded context-specific data blob.
    );

    event LotCreated (
        uint256 lotId, // id of the created Lot.
        uint256[] nonFungibleTokens, // initial Lot supply of non-fungible tokens.
        uint256 fungibleAmount, // initial fungible token amount bundled with each NFT.
        uint256 price // initial Lot item price.
    );

    event LotNonFungibleSupplyUpdated (
        uint256 lotId, // id of the Lot whose supply of non-fungible tokens was updated.
        uint256[] nonFungibleTokens // the non-fungible tokens that updated the supply.
    );

    event LotFungibleAmountUpdated (
        uint256 lotId, // id of the Lot whose fungible token amount was updated.
        uint256 fungibleAmount // updated fungible token amount.
    );

    event LotPriceUpdated (
        uint256 lotId, // id of the Lot whose item price was updated.
        uint256 price // updated item price.
    );

    IERC20 public _payoutTokenAddress; // payout currency token contract address.

    uint256 public _fungibleTokenId; // inventory token id of the fungible tokens bundled in a Lot item.

    address public _inventoryContract; // inventory contract address.

    mapping (uint256 => Lot) public _lots; // mapping of lotId => Lot.

    uint256 public _startedAt; // starting timestamp of the Lot sale.

    modifier whenStarted() {
        require(_startedAt != 0);
        _;
    }

    modifier whenNotStarted() {
        require(_startedAt == 0);
        _;
    }

    /**
     * @dev Constructor.
     * @param kyberProxy Kyber network proxy contract.
     * @param payoutWallet Account to receive payout currency tokens from the Lot sales.
     * @param payoutTokenAddress Payout currency token contract address.
     * @param fungibleTokenId Inventory token id of the fungible tokens bundled in a Lot item.
     * @param inventoryContract Address of the inventory contract to use in the delivery of purchased Lot items.
     */
    constructor(
        address kyberProxy,
        address payable payoutWallet,
        IERC20 payoutTokenAddress,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        KyberAdapter(kyberProxy)
        PayoutWallet(payoutWallet)
        public
    {
        pause();

        setPayoutTokenAddress(payoutTokenAddress);
        setFungibleTokenId(fungibleTokenId);
        setInventoryContract(inventoryContract);
    }

    /**
     * @dev Sets which token to use as the payout currency from the Lot sales.
     * @param payoutTokenAddress Payout currency token contract address to use.
     */
    function setPayoutTokenAddress(
        IERC20 payoutTokenAddress
    )
        public
        onlyOwner
        whenPaused
    {
        require(payoutTokenAddress != IERC20(0));
        require(payoutTokenAddress != _payoutTokenAddress);

        _payoutTokenAddress = payoutTokenAddress;
    }

    /**
     * @dev Sets the inventory token id of the fungible tokens bundled in a Lot item.
     * @param fungibleTokenId Inventory token id of the fungible tokens to bundle in a Lot item.
     */
    function setFungibleTokenId(
        uint256 fungibleTokenId
    )
        public
        onlyOwner
        whenNotStarted
    {
        require(fungibleTokenId != 0);
        require(fungibleTokenId != _fungibleTokenId);

        _fungibleTokenId = fungibleTokenId;
    }

    /**
     * @dev Sets the inventory contract to use in the delivery of purchased Lot items.
     * @param inventoryContract Address of the inventory contract to use.
     */
    function setInventoryContract(
        address inventoryContract
    )
        public
        onlyOwner
        whenNotStarted
    {
        require(inventoryContract != address(0));
        require(inventoryContract != _inventoryContract);

        _inventoryContract = inventoryContract;
    }

    /**
     * @dev Starts the sale
     */
    function start()
        public
        onlyOwner
        whenNotStarted
    {
        // solium-disable-next-line security/no-block-members
        _startedAt = now;

        unpause();
    }

    function pause()
        public
        onlyOwner
    {
        _pause();
    }

    function unpause()
        public onlyOwner
    {
        _unpause();
    }

    /**
     * @dev Creates a new Lot to add to the sale.
     * There are NO guarantees about the uniqueness of the non-fungible token supply.
     * Lot item price must be at least 0.00001 of the base denomination.
     * @param lotId Id of the Lot to create.
     * @param nonFungibleSupply Initial non-fungible token supply of the Lot.
     * @param fungibleAmount Initial fungible token amount to bundle with each NFT.
     * @param price Initial Lot item sale price, in payout currency tokens
     */
    function createLot(
        uint256 lotId,
        uint256[] memory nonFungibleSupply,
        uint256 fungibleAmount,
        uint256 price
    )
        public
        onlyOwner
        whenNotStarted
    {
        require(!_lots[lotId].exists);

        Lot memory lot;
        lot.exists = true;
        lot.nonFungibleSupply = nonFungibleSupply;
        lot.fungibleAmount = fungibleAmount;
        lot.price = price;
        lot.numAvailable = nonFungibleSupply.length;

        _lots[lotId] = lot;

        emit LotCreated(lotId, nonFungibleSupply, fungibleAmount, price);
    }

    /**
     * @dev Updates the given Lot's non-fungible token supply with additional NFTs.
     * There are NO guarantees about the uniqueness of the non-fungible token supply.
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
        require(nonFungibleTokens.length != 0);

        Lot memory lot = _lots[lotId];

        require(lot.exists);

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
     * @dev Updates the given Lot's fungible token amount bundled with each NFT.
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
        require(_lots[lotId].exists);
        require(_lots[lotId].fungibleAmount != fungibleAmount);

        _lots[lotId].fungibleAmount = fungibleAmount;

        emit LotFungibleAmountUpdated(lotId, fungibleAmount);
    }

    /**
     * @dev Updates the given Lot's item sale price.
     * @param lotId Id of the Lot to update.
     * @param price The new sale price, in payout currency tokens, to update with.
     */
    function updateLotPrice(
        uint256 lotId,
        uint256 price
    )
        external
        onlyOwner
        whenPaused
    {
        require(_lots[lotId].exists);
        require(_lots[lotId].price != price);

        _lots[lotId].price = price;

        emit LotPriceUpdated(lotId, price);
    }

    /**
     * @dev Returns the given number of next available non-fungible tokens for the specified Lot.
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
        Lot memory lot = _lots[lotId];

        require(lot.exists);

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
     * @dev Purchases a quantity of Lot items for the given Lot id.
     * @param recipient Destination account to receive the purchased Lot items.
     * @param lotId Lot id of the items to purchase.
     * @param quantity Quantity of Lot items to purchase.
     * @param tokenAddress Purchase currency token contract address.
     * @param maxTokenAmount Maximum amount of purchase tokens to spend for the purchase.
     * @param minConversionRate Minimum conversion rate, from purchase tokens to payout tokens, to allow for the purchase to succeed.
     * @param extData Additional string encoded custom data to pass through to the event.
     */
    function purchaseFor(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress,
        uint256 maxTokenAmount,
        uint256 minConversionRate,
        string calldata extData
    )
        external
        payable
        whenNotPaused
        whenStarted
    {
        require(recipient != address(0));
        require(recipient != address(uint160(address(this))));
        require (quantity > 0);
        require(tokenAddress != IERC20(0));

        PurchaseForVars memory purchaseForVars;
        purchaseForVars.recipient = recipient;
        purchaseForVars.lotId = lotId;
        purchaseForVars.quantity = quantity;
        purchaseForVars.tokenAddress = tokenAddress;
        purchaseForVars.maxTokenAmount = maxTokenAmount;
        purchaseForVars.minConversionRate = minConversionRate;
        purchaseForVars.extData = extData;
        purchaseForVars.operator = msg.sender;
        purchaseForVars.lot = _lots[lotId];

        require(purchaseForVars.lot.exists);
        require(quantity <= purchaseForVars.lot.numAvailable);

        purchaseForVars.nonFungibleTokens = new uint256[](quantity);

        uint256 nonFungibleSupplyOffset = purchaseForVars.lot.nonFungibleSupply.length.sub(purchaseForVars.lot.numAvailable);

        for (uint256 index = 0; index < quantity; index++) {
            uint256 position = nonFungibleSupplyOffset.add(index);
            purchaseForVars.nonFungibleTokens[index] = purchaseForVars.lot.nonFungibleSupply[position];
        }

        purchaseForVars.totalFungibleAmount = purchaseForVars.lot.fungibleAmount.mul(quantity);

        _purchaseFor(purchaseForVars);

        _lots[lotId].numAvailable = purchaseForVars.lot.numAvailable.sub(quantity);
    }

    /**
     * @dev Retrieves user purchase price information for the given quantity of Lot items.
     * @param recipient The user for whom the price information is being retrieved for.
     * @param lotId Lot id of the items from which the purchase price information will be retrieved.
     * @param quantity Quantity of Lot items from which the purchase price information will be retrieved.
     * @param tokenAddress Purchase currency token contract address.
     * @return minConversionRate Minimum conversion rate from purchase tokens to payout tokens.
     * @return totalPrice Total price (excluding any discounts), in purchase currency tokens.
     * @return totalDiscounts Total discounts to apply to the total price, in purchase currency tokens.
     */
    function getPrice(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress
    )
        external
        view
        returns
    (
        uint256 minConversionRate,
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        Lot memory lot = _lots[lotId];

        require(lot.exists);
        require(tokenAddress != IERC20(0));

        (totalPrice, totalDiscounts) = _getPrice(recipient, lot, quantity);

        if (tokenAddress == _payoutTokenAddress) {
            minConversionRate = 1000000000000000000;
        } else {
            (, uint tokenAmount) = _convertToken(_payoutTokenAddress, totalPrice, tokenAddress);
            (, minConversionRate) = kyber.getExpectedRate(tokenAddress, _payoutTokenAddress, tokenAmount);

            if (totalPrice > 0) {
                totalPrice = ceilingDiv(totalPrice.mul(10**36), minConversionRate);
                totalPrice = _fixTokenDecimals(_payoutTokenAddress, tokenAddress, totalPrice, true);
            }

            if (totalDiscounts > 0) {
                totalDiscounts = ceilingDiv(totalDiscounts.mul(10**36), minConversionRate);
                totalDiscounts = _fixTokenDecimals(_payoutTokenAddress, tokenAddress, totalDiscounts, true);
            }
        }
    }

    /**
     * @dev Defines the purchase lifecycle sequence to execute when handling a purchase.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseFor(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
    {
        (purchaseForVars.totalPrice, purchaseForVars.totalDiscounts) =
            _purchaseForPricing(purchaseForVars);

        (purchaseForVars.tokensSent, purchaseForVars.tokensReceived) =
            _purchaseForPayment(purchaseForVars);

        _purchaseForDelivery(purchaseForVars);
        _purchaseForNotify(purchaseForVars);
    }

    /**
     * @dev Purchase lifecycle hook that handles the calculation of the total price and total discounts, in payout currency tokens.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     * @return totalPrice Total price (excluding any discounts), in payout currency tokens.
     * @return totalDiscounts Total discounts to apply to the total price, in payout currency tokens.
     */
    function _purchaseForPricing(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
        returns
    (
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        (totalPrice, totalDiscounts) =
            _getPrice(
                purchaseForVars.recipient,
                purchaseForVars.lot,
                purchaseForVars.quantity);

        require(totalDiscounts <= totalPrice);
    }

    /**
     * @dev Purchase lifecycle hook that handles the conversion and transfer of payment tokens.
     * @dev Any overpayments result in the change difference being returned to the recipient, in purchase currency tokens.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     * @return purchaseTokensSent The amount of actual purchase tokens paid by the recipient.
     * @return payoutTokensReceived The amount of actual payout tokens received by the payout wallet.
     */
    function _purchaseForPayment(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
        returns
    (
        uint256 purchaseTokensSent,
        uint256 payoutTokensReceived
    )
    {
        uint256 totalDiscountedPrice = purchaseForVars.totalPrice.sub(purchaseForVars.totalDiscounts);

        (purchaseTokensSent, payoutTokensReceived) =
            _swapTokenAndHandleChange(
                purchaseForVars.tokenAddress,
                purchaseForVars.maxTokenAmount,
                _payoutTokenAddress,
                totalDiscountedPrice,
                purchaseForVars.minConversionRate,
                purchaseForVars.operator,
                address(uint160(address(this))));

        require(payoutTokensReceived >= totalDiscountedPrice);
        require(_payoutTokenAddress.transfer(_payoutWallet, payoutTokensReceived));
    }

    /**
     * @dev Purchase lifecycle hook that handles the delivery of purchased fungible and non-fungible tokens to the recipient.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForDelivery(PurchaseForVars memory purchaseForVars) internal virtual;

    /**
     * @dev Purchase lifecycle hook that handles the notification of a purchase event.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForNotify(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
    {
        emit Purchased(
            purchaseForVars.recipient,
            purchaseForVars.operator,
            purchaseForVars.lotId,
            purchaseForVars.quantity,
            purchaseForVars.nonFungibleTokens,
            purchaseForVars.totalFungibleAmount,
            purchaseForVars.totalPrice,
            purchaseForVars.totalDiscounts,
            address(purchaseForVars.tokenAddress),
            purchaseForVars.tokensSent,
            purchaseForVars.tokensReceived,
            purchaseForVars.extData);
    }

    /**
     * @dev Retrieves user payout price information for the given quantity of Lot items.
     * @dev @param recipient The user for whom the price information is being retrieved for.
     * @param lot Lot of the items from which the purchase price information will be retrieved.
     * @param quantity Quantity of Lot items from which the purchase price information will be retrieved.
     * @return totalPrice Total price (excluding any discounts), in payout currency tokens.
     * @return totalDiscounts Total discounts to apply to the total price, in payout currency tokens.
     */
    function _getPrice(
        address payable /* recipient */,
        Lot memory lot,
        uint256 quantity
    )
        internal
        virtual
        pure
        returns
    (
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        totalPrice = lot.price.mul(quantity);
        totalDiscounts = 0;
    }
}
