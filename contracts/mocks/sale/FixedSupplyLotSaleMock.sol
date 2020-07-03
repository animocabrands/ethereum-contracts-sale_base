// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@animoca/ethereum-contracts-assets_inventory/contracts/mocks/token/ERC1155721/AssetsInventoryMock.sol";
import "../../sale/FixedSupplyLotSale.sol";

contract FixedSupplyLotSaleMock is FixedSupplyLotSale {

    event UnderscorePurchaseForCalled();

    event UnderscorePurchaseForPricingCalled();

    event UnderscorePurchaseForPaymentCalled();

    event UnderscorePurchaseForDeliveryCalled();

    event UnderscorePurchaseForNotifyCalled();

    event UnderscorePurchaseForPricingResult(
        uint256 totalPrice,
        uint256 totalDiscounts
    );

    event UnderscorePurchaseForPaymentResult(
        uint256 purchaseTokensSent,
        uint256 payoutTokensReceived
    );

    constructor(
        address kyberProxy,
        address payable payoutWallet,
        IERC20 payoutTokenAddress,
        uint256 fungibleTokenId,
        address inventoryContract
    )
        FixedSupplyLotSale(
            kyberProxy,
            payoutWallet,
            payoutTokenAddress,
            fungibleTokenId,
            inventoryContract
        )
        public
    {}

    function _purchaseFor(
        PurchaseForVars memory purchaseForVars
    )
        internal
        override
    {
        super._purchaseFor(purchaseForVars);
        emit UnderscorePurchaseForCalled();
    }

    function _purchaseForPricing(
        PurchaseForVars memory purchaseForVars
    )
        internal
        override
        returns
    (
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        (totalPrice, totalDiscounts) = super._purchaseForPricing(purchaseForVars);
        emit UnderscorePurchaseForPricingCalled();
    }

    function _purchaseForPayment(
        PurchaseForVars memory purchaseForVars
    )
        internal
        override
        returns
    (
        uint256 purchaseTokensSent,
        uint256 payoutTokensReceived
    )
    {
        (purchaseTokensSent, payoutTokensReceived) = super._purchaseForPayment(purchaseForVars);
        emit UnderscorePurchaseForPaymentCalled();
    }

    function _purchaseForDelivery(
        PurchaseForVars memory /*purchaseForVars*/
    )
        internal
        override
    {
        emit UnderscorePurchaseForDeliveryCalled();
    }

    function _purchaseForNotify(
        PurchaseForVars memory purchaseForVars
    )
        internal
        override
    {
        super._purchaseForNotify(purchaseForVars);
        emit UnderscorePurchaseForNotifyCalled();
    }

    function getLotNonFungibleSupply(
        uint256 lotId
    )
        external
        view
        returns
    (
        uint256[] memory
    )
    {
        require(_lots[lotId].exists);
        return _lots[lotId].nonFungibleSupply;
    }

    function setLotNumAvailable(
        uint256 lotId,
        uint256 numAvailable
    )
        external
    {
        require(_lots[lotId].exists);
        require(_lots[lotId].numAvailable <= _lots[lotId].nonFungibleSupply.length);
        _lots[lotId].numAvailable = numAvailable;
    }

    function getPurchaseForVars(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress,
        uint256 maxTokenAmount,
        uint256 minConversionRate,
        string memory extData
    )
        private
        view
        returns
    (
        FixedSupplyLotSale.PurchaseForVars memory purchaseForVars
    )
    {
        purchaseForVars.recipient = recipient;
        purchaseForVars.lotId = lotId;
        purchaseForVars.quantity = quantity;
        purchaseForVars.tokenAddress = tokenAddress;
        purchaseForVars.maxTokenAmount = maxTokenAmount;
        purchaseForVars.minConversionRate = minConversionRate;
        purchaseForVars.extData = extData;
        purchaseForVars.operator = msg.sender;
        purchaseForVars.lot = _lots[lotId];

        purchaseForVars.nonFungibleTokens = new uint256[](quantity);

        uint256 nonFungibleSupplyOffset = purchaseForVars.lot.nonFungibleSupply.length.sub(purchaseForVars.lot.numAvailable);

        for (uint256 index = 0; index < quantity; index++) {
            uint256 position = nonFungibleSupplyOffset.add(index);
            purchaseForVars.nonFungibleTokens[index] = purchaseForVars.lot.nonFungibleSupply[position];
        }

        purchaseForVars.totalFungibleAmount = purchaseForVars.lot.fungibleAmount.mul(quantity);
    }

    function callUnderscorePurchaseFor(
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
    {
        FixedSupplyLotSale.PurchaseForVars memory purchaseForVars =
            getPurchaseForVars(
                recipient,
                lotId,
                quantity,
                tokenAddress,
                maxTokenAmount,
                minConversionRate,
                extData);

        _purchaseFor(purchaseForVars);
    }

    function callUnderscorePurchaseForPricing(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress,
        uint256 maxTokenAmount,
        uint256 minConversionRate,
        string calldata extData
    )
        external
    {
        FixedSupplyLotSale.PurchaseForVars memory purchaseForVars =
            getPurchaseForVars(
                recipient,
                lotId,
                quantity,
                tokenAddress,
                maxTokenAmount,
                minConversionRate,
                extData);

        uint256 totalPrice = 0;
        uint256 totalDiscounts = 0;

        (totalPrice, totalDiscounts) =
            _purchaseForPricing(purchaseForVars);

        emit UnderscorePurchaseForPricingResult(totalPrice, totalDiscounts);
    }

    function callUnderscorePurchaseForPayment(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress,
        uint256 maxTokenAmount,
        uint256 minConversionRate,
        string calldata extData,
        uint256 totalPrice,
        uint256 totalDiscounts
    )
        external
        payable
    {
        FixedSupplyLotSale.PurchaseForVars memory purchaseForVars =
            getPurchaseForVars(
                recipient,
                lotId,
                quantity,
                tokenAddress,
                maxTokenAmount,
                minConversionRate,
                extData);

        purchaseForVars.totalPrice = totalPrice;
        purchaseForVars.totalDiscounts = totalDiscounts;

        uint256 purchaseTokensSent = 0;
        uint256 payoutTokensReceived = 0;

        (purchaseTokensSent, payoutTokensReceived) =
            _purchaseForPayment(purchaseForVars);

        emit UnderscorePurchaseForPaymentResult(purchaseTokensSent, payoutTokensReceived);
    }

    function callUnderscorePurchaseForNotify(
        address payable recipient,
        uint256 lotId,
        uint256 quantity,
        IERC20 tokenAddress,
        uint256 maxTokenAmount,
        uint256 minConversionRate,
        string calldata extData,
        uint256 totalPrice,
        uint256 totalDiscounts,
        uint256 tokensSent,
        uint256 tokensReceived
    )
        external
    {
        FixedSupplyLotSale.PurchaseForVars memory purchaseForVars =
            getPurchaseForVars(
                recipient,
                lotId,
                quantity,
                tokenAddress,
                maxTokenAmount,
                minConversionRate,
                extData);

        purchaseForVars.totalPrice = totalPrice;
        purchaseForVars.totalDiscounts = totalDiscounts;
        purchaseForVars.tokensSent = tokensSent;
        purchaseForVars.tokensReceived = tokensReceived;

        _purchaseForNotify(purchaseForVars);
    }

    function callUnderscoreGetPrice(
        address payable recipient,
        uint256 lotId,
        uint256 quantity
    )
        external
        view
        returns
    (
        uint256 totalPrice,
        uint256 totalDiscounts
    )
    {
        (totalPrice, totalDiscounts) =
            _getPrice(recipient, _lots[lotId], quantity);
    }
}
