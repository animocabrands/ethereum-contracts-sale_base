const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const Constants = require('@animoca/ethereum-contracts-core_library').constants;

const { stringToBytes32, uintToBytes32, bytes32ArrayToBytes, bytes32ToUint } = require('../utils/bytes32');

const Sale = artifacts.require('SaleMock');

contract('Sale', function ([
    _,
    owner,
    operator,
    purchaser,
    ...accounts
]) {
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const allSkus = [
        Constants.Zero,
        Constants.One
    ].map(item => uintToBytes32(item));

    const allTokens = [
        Constants.ZeroAddress,
        EthAddress
    ];

    const unknownSku = uintToBytes32(Constants.Two);
    const unknownToken = '0x1111222233334444555566667777888899990000';

    const allPrices = [
        ether('1'),
        ether('10')
    ].map(item => item.toString());

    const userData = bytes32ArrayToBytes([ stringToBytes32('userData') ]);

    async function shouldHaveStartedTheSale(state) {
        const startedAt = await this.contract.startedAt();

        if (state) {
            startedAt.should.be.bignumber.gt(Constants.Zero);
        } else {
            startedAt.should.be.bignumber.equal(Constants.Zero);
        }
    }

    async function shouldHavePausedTheSale(state) {
        const paused = await this.contract.paused();

        if (state) {
            paused.should.be.true;
        } else {
            paused.should.be.false;
        }
    }

    beforeEach(async function () {
        this.contract = await Sale.new({ from: owner });
    });

    describe('start()', function () {
        const [ notOwner ] = accounts;

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.contract.start({ from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the sale has already started', async function () {
            await this.contract.start({ from: owner });
            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert(
                this.contract.start({ from: owner }),
                'Startable: started');
        });

        it('should start the sale', async function () {
            await shouldHaveStartedTheSale.bind(this, false)();

            await this.contract.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();
        });

        it('should unpause the sale', async function () {
            await shouldHavePausedTheSale.bind(this, true)();

            await this.contract.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();
        });
    });

    describe('pause()', function () {
        const [ notOwner ] = accounts;

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.contract.pause({ from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the sale has not started', async function () {
            await shouldHaveStartedTheSale.bind(this, false)();

            await expectRevert(
                this.contract.pause({ from: owner }),
                'Startable: not started');
        });

        it('should pause the sale', async function () {
            await this.contract.start({ from: owner });
            await shouldHavePausedTheSale.bind(this, false)();

            await this.contract.pause({ from: owner });

            await shouldHavePausedTheSale.bind(this, true)();
        });
    });

    describe('unpause()', function () {
        const [ notOwner ] = accounts;

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.contract.unpause({ from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the sale has not started', async function () {
            await shouldHaveStartedTheSale.bind(this, false)();

            await expectRevert(
                this.contract.unpause({ from: owner }),
                'Startable: not started');
        });

        it('should unpause the sale', async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner });
            await shouldHavePausedTheSale.bind(this, true);

            await this.contract.unpause({ from: owner });

            await shouldHavePausedTheSale.bind(this, false);
        });
    });

    describe('addInventorySkus()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner });
        });

        it('reverts if called by any other than the owner', async function () {
            const skus = allSkus;

            await expectRevert(
                this.contract.addInventorySkus(skus, { from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            const skus = allSkus;

            await this.contract.unpause({ from: owner });

            await expectRevert(
                this.contract.addInventorySkus(skus, { from: owner }),
                'Pausable: not paused');
        });

        context('when adding zero skus', function () {
            it('should emit the InventorySkusAdded event', async function () {
                const skus = [];

                const receipt = await this.contract.addInventorySkus(skus, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'InventorySkusAdded',
                    {
                        skus: skus,
                        added: []
                    });
            });
        });

        context('when adding one sku', function () {
            it('should emit the InventorySkusAdded event', async function () {
                const skus = [allSkus[0]];

                const receipt = await this.contract.addInventorySkus(skus, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'InventorySkusAdded',
                    {
                        skus: skus,
                        added: [true]
                    });
            });
        });

        context('when adding multiple skus', function () {
            it('should emit the InventorySkusAdded event', async function () {
                const skus = allSkus;

                const receipt = await this.contract.addInventorySkus(skus, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'InventorySkusAdded',
                    {
                        skus: allSkus,
                        added: [true, true]
                    });
            });
        });
    });

    describe('isInventorySku()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner });
            await this.contract.addInventorySkus(allSkus, { from: owner });
        });

        it('should return `false` for an unknown inventory SKU', async function () {
            const isInventorySku =
                await this.contract.isInventorySku(unknownSku, { from: purchaser });

            isInventorySku.should.be.false;
        });

        it('should return `true` for an added inventory SKU', async function () {
            const isInventorySku =
                await this.contract.isInventorySku(allSkus[0], { from: purchaser });

            isInventorySku.should.be.true;
        });
    });

    describe('addSupportedPaymentTokens()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner });
        });

        it('reverts if called by any other than the owner', async function () {
            const tokens = allTokens;

            await expectRevert(
                this.contract.addSupportedPaymentTokens(tokens, { from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            const tokens = allTokens;

            await this.contract.unpause({ from: owner });

            await expectRevert(
                this.contract.addSupportedPaymentTokens(tokens, { from: owner }),
                'Pausable: not paused');
        });

        context('when adding zero tokens', function () {
            it('should emit the SupportedPaymentTokensAdded event', async function () {
                const tokens = [];

                const receipt = await this.contract.addSupportedPaymentTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPaymentTokensAdded',
                    {
                        tokens: tokens,
                        added: []
                    });
            });
        });

        context('when adding one token', function () {
            it('should emit the SupportedPaymentTokensAdded event', async function () {
                const tokens = [allTokens[0]];

                const receipt = await this.contract.addSupportedPaymentTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPaymentTokensAdded',
                    {
                        tokens: tokens,
                        added: [true]
                    });
            });
        });

        context('when adding multiple tokens', function () {
            it('should emit the SupportedPaymentTokensAdded event', async function () {
                const tokens = allTokens;

                const receipt = await this.contract.addSupportedPaymentTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPaymentTokensAdded',
                    {
                        tokens: tokens,
                        added: [true, true]
                    });
            });
        });
    });

    describe('isSupportedPaymentToken()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner });
            await this.contract.addSupportedPaymentTokens(allTokens, { from: owner });
        });

        it('should return `false` for an unknown payment token', async function () {
            const isSupportedPaymentToken =
                await this.contract.isSupportedPaymentToken(unknownToken, { from: purchaser });

            isSupportedPaymentToken.should.be.false;
        });

        it('should return `true` for a supported payment token', async function () {
            const isSupportedPaymentToken =
                await this.contract.isSupportedPaymentToken(allTokens[0], { from: purchaser });

            isSupportedPaymentToken.should.be.true;
        });
    });

    describe('setSkuTokenPrices()', function () {
        beforeEach(async function () {
            const skus = [allSkus[0]];
            const tokens = allTokens;

            await this.contract.addInventorySkus(skus, { from: owner});
            await this.contract.addSupportedPaymentTokens(tokens, { from: owner});

            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner })
        });

        it('reverts if called by any other than the owner', async function () {
            const sku = allSkus[0];
            const tokens = [allTokens[0]];
            const prices = [allPrices[0]];

            await expectRevert(
                this.contract.setSkuTokenPrices(sku, tokens, prices, { from: purchaser}),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            await this.contract.unpause({ from: owner });

            const sku = allSkus[0];
            const tokens = [allTokens[0]];
            const prices = [allPrices[0]];

            await expectRevert(
                this.contract.setSkuTokenPrices(sku, tokens, prices, { from: owner}),
                'Pausable: not paused');
        });

        context('when setting zero prices', function () {
            it('should emit the SkuTokenPricesUpdated event', async function () {
                const sku = allSkus[0];
                const tokens = [];
                const prices = [];

                const receipt = await this.contract.setSkuTokenPrices(sku, tokens, prices, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SkuTokenPricesUpdated',
                    {
                        sku: sku,
                        tokens: tokens,
                        prices: prices,
                        prevPrices: [].map(item => item.toString())
                    });
            });
        });

        context('when setting one price', function () {
            it('should emit the SkuTokenPricesUpdated event', async function () {
                const sku = allSkus[0];
                const tokens = [allTokens[0]];
                const prices = [allPrices[0]];

                const receipt = await this.contract.setSkuTokenPrices(sku, tokens, prices, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SkuTokenPricesUpdated',
                    {
                        sku: sku,
                        tokens: tokens,
                        prices: prices,
                        prevPrices: [Constants.Zero].map(item => item.toString())
                    });
            });
        });

        context('when setting multiple prices', function () {
            it('should emit the SkuTokenPricesUpdated event', async function () {
                const sku = allSkus[0];
                const tokens = allTokens;
                const prices = allPrices;

                const receipt = await this.contract.setSkuTokenPrices(sku, tokens, prices, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SkuTokenPricesUpdated',
                    {
                        sku: sku,
                        tokens: tokens,
                        prices: prices,
                        prevPrices: [Constants.Zero, Constants.Zero].map(item => item.toString())
                    });
            });
        });
    });

    describe('getPrice()', function () {
        const quantity = Constants.One;

        beforeEach(async function () {
            await this.contract.addInventorySkus(allSkus, { from: owner});
            await this.contract.addSupportedPaymentTokens(allTokens, { from: owner});

            for (const sku of allSkus) {
                await this.contract.setSkuTokenPrices(sku, allTokens, allPrices, { from: owner});
            }
        });

        it('should return correct price', async function () {
            allTokens.length.should.be.equal(allPrices.length);

            const numTokenPrices = allTokens.length;

            for (const sku of allSkus) {
                for (let index = 0; index < numTokenPrices; ++index) {
                    const token = allTokens[index];
                    const price = new BN(allPrices[index]);

                    const totalPrice =
                        await this.contract.getPrice(
                            purchaser,
                            token,
                            sku,
                            quantity,
                            userData);

                    const expectedTotalPrice = price.mul(quantity);
                    totalPrice.should.be.bignumber.equal(expectedTotalPrice);
                }
            }
        });
    });

    describe('purchaseFor()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        context('when the sale has not started', function () {
            it('should revert', async function () {
                await expectRevert(
                    this.contract.purchaseFor(
                        purchaser,
                        paymentToken,
                        sku,
                        quantity,
                        userData,
                        { value: quantity }),
                    'Startable: not started');
            });
        });

        context('when the sale has started', function () {
            beforeEach(async function () {
                await this.contract.addInventorySkus([sku], { from: owner});
                await this.contract.addSupportedPaymentTokens([paymentToken], { from: owner});
                await this.contract.start({ from: owner });
            });

            it('should revert if the sale is paused', async function () {
                await this.contract.pause({ from: owner });

                await expectRevert(
                    this.contract.purchaseFor(
                        purchaser,
                        paymentToken,
                        sku,
                        quantity,
                        userData,
                        { value: quantity }),
                    'Pausable: paused');
            });

            it('should call _purchaseFor()', async function () {
                const receipt = await this.contract.purchaseFor(
                    purchaser,
                    paymentToken,
                    sku,
                    quantity,
                    userData,
                    { value: quantity });

                expectEvent(
                    receipt,
                    'UnderscorePurchaseForCalled');
            });
        });
    });

    describe('_purchaseFor()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        beforeEach(async function () {
            await this.contract.addInventorySkus([sku], { from: owner});
            await this.contract.addSupportedPaymentTokens([paymentToken], { from: owner});
            await this.contract.start({ from: owner });

            this.receipt = await this.contract.purchaseFor(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData,
                { value: quantity });
        });

        it('should call all of the lifecycle functions', async function () {
            expectEvent(
                this.receipt,
                'UnderscorePurchaseForCalled');
        });
    });

    describe('_validatePurchase()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        beforeEach(async function () {
            await this.contract.addInventorySkus([sku], { from: owner});
            await this.contract.addSupportedPaymentTokens([paymentToken], { from: owner});
        });

        it('should revert if the purchaser is the zero-address', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    Constants.ZeroAddress,
                    paymentToken,
                    sku,
                    quantity,
                    userData,
                    { from: operator }),
                'Sale: zero address purchaser');
        });

        it('should revert if the purchaser is the sale contract address', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    this.contract.address,
                    paymentToken,
                    sku,
                    quantity,
                    userData,
                    { from: operator }),
                'Sale: contract address purchaser');
        });

        it('should revert if the payment token is unsupported', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    purchaser,
                    Constants.ZeroAddress,
                    sku,
                    quantity,
                    userData,
                    { from: operator }),
                'Sale: unsupported token');
        });

        it('should revert if the sku doesnt exist', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    purchaser,
                    paymentToken,
                    uintToBytes32(Constants.Two),
                    quantity,
                    userData,
                    { from: operator }),
                'Sale: non-existent sku');
        });

        it('should revert if the purchase quantity is zero', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    purchaser,
                    paymentToken,
                    sku,
                    Constants.Zero,
                    userData,
                    { from: operator }),
                'Sale: zero quantity purchase');
        });
    });

    describe('_calculatePrice()', function () {
        const paymentToken = allTokens[0];
        const sku = allSkus[0];
        const price = new BN(allPrices[0]);
        const quantity = Constants.One;

        beforeEach(async function () {
            await this.contract.addInventorySkus(allSkus, { from: owner});
            await this.contract.addSupportedPaymentTokens(allTokens, { from: owner});

            for (const sku of allSkus) {
                await this.contract.setSkuTokenPrices(sku, allTokens, allPrices, { from: owner});
            }
        });

        it('should return the correct price info', async function () {
            const receipt = await this.contract.callUnderscoreCalculatePrice(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData);

            expectEvent(
                receipt,
                'UnderscoreCalculatePriceResult',
                { priceInfo: [ uintToBytes32(price.mul(quantity)) ] });
        });
    });

    describe('_transferFunds()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        it('should return the correct payment info', async function () {
            const receipt = await this.contract.callUnderscoreTransferFunds(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData,
                [], // priceInfo
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreTransferFundsResult',
                { paymentInfo: [ uintToBytes32(Constants.Two) ] });
        });
    });

    describe('_deliverGoods()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        it('should return the correct delivery info', async function () {
            const receipt = await this.contract.callUnderscoreDeliverGoods(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData,
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreDeliverGoodsResult',
                { deliveryInfo: [ uintToBytes32(Constants.Three) ] });
        });
    });

    describe('_finalizePurchase()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        it('should return the correct finalize info', async function () {
            const receipt = await this.contract.callUnderscoreFinalizePurchase(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData,
                [], // priceInfo
                [], // paymentInfo
                [], // deliveryInfo
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreFinalizePurchaseResult',
                { finalizeInfo: [ uintToBytes32(Constants.Four) ] });
        });
    });

    describe('_notifyPurchased()', function () {
        it('should emit the `Purchased` event', async function () {
            const paymentToken = EthAddress;
            const sku = allSkus[0];
            const quantity = Constants.One;

            const receipt = await this.contract.callUnderscoreNotifyPurchased(
                purchaser,
                paymentToken,
                sku,
                quantity,
                userData,
                [
                    uintToBytes32(new BN(9)),
                    uintToBytes32(new BN(8)),
                    uintToBytes32(new BN(7)),
                    uintToBytes32(new BN(6))
                ],
                [
                    uintToBytes32(Constants.Five),
                    uintToBytes32(Constants.Four),
                    uintToBytes32(Constants.Three)
                ],
                [
                    uintToBytes32(Constants.Two),
                    uintToBytes32(Constants.One)
                ],
                [
                    uintToBytes32(Constants.Zero)
                ],
                {
                    from: operator,
                    value: quantity
                });

            expectEvent(
                receipt,
                'Purchased',
                {
                    purchaser: purchaser,
                    operator: operator,
                    sku: sku,
                    quantity: quantity,
                    paymentToken: paymentToken,
                    userData: userData,
                    purchaseData: [
                        uintToBytes32(new BN(9)),
                        uintToBytes32(new BN(8)),
                        uintToBytes32(new BN(7)),
                        uintToBytes32(new BN(6)),
                        uintToBytes32(Constants.Five),
                        uintToBytes32(Constants.Four),
                        uintToBytes32(Constants.Three),
                        uintToBytes32(Constants.Two),
                        uintToBytes32(Constants.One),
                        uintToBytes32(Constants.Zero)
                    ]
                });
        });
    });

    describe('_getPurchasedEventPurchaseData()', function () {
        const paymentToken = EthAddress;
        const sku = allSkus[0];
        const quantity = Constants.One;

        it('should return the correct Purchased event extra data', async function () {
            const purchasedEventPurchaseData =
                await this.contract.callUnderscoreGetPurchasedEventPurchaseData();

            for (let index = 0; index < 10; ++index) {
                purchasedEventPurchaseData[index].should.be.equal(uintToBytes32(index));
            }
        });
    });

    describe('_getTotalPriceInfo()', function () {
        const quantity = Constants.One;

        beforeEach(async function () {
            await this.contract.addInventorySkus(allSkus, { from: owner});
            await this.contract.addSupportedPaymentTokens(allTokens, { from: owner});

            for (const sku of allSkus) {
                await this.contract.setSkuTokenPrices(sku, allTokens, allPrices, { from: owner});
            }
        });

        it('should return correct total price pricing info', async function () {
            allTokens.length.should.be.equal(allPrices.length);

            const numTokenPrices = allTokens.length;

            for (const sku of allSkus) {
                for (let index = 0; index < numTokenPrices; ++index) {
                    const token = allTokens[index];
                    const price = allPrices[index];

                    const totalPriceInfo =
                        await this.contract.callUnderscoreGetTotalPriceInfo(
                            purchaser,
                            token,
                            sku,
                            quantity,
                            userData);

                    const expectedTotalPrice = new BN(price).mul(quantity);
                    bytes32ToUint(totalPriceInfo[0]).should.be.bignumber.equal(expectedTotalPrice);
                }
            }
        });
    });
});
