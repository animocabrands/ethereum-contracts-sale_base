const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { toHex, padLeft } = require('web3-utils');

const Sale = artifacts.require('SaleMock');

contract('Sale', function ([
    _,
    owner,
    operator,
    purchaser,
    ...accounts
]) {
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const sku = toBytes32(Constants.Zero);
    const extData = [ toBytes32('extData') ];

    function toBytes32(value) {
        return padLeft(toHex(value), 64);
    }

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
            await this.contract.pause({ from: owner })
        });

        it('reverts if called by any other than the owner', async function () {
            const skus = [Constants.Zero].map(item => toBytes32(item));

            await expectRevert(
                this.contract.addInventorySkus(skus, { from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            await this.contract.unpause({ from: owner });

            const skus = [Constants.Zero].map(item => toBytes32(item));

            await expectRevert(
                this.contract.addInventorySkus(skus, { from: owner }),
                'Pausable: not paused');
        });

        context('when adding zero skus', function () {
            it('should emit the InventorySkusAdded event', async function () {
                const skus = [].map(item => toBytes32(item));
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
                const skus = [Constants.Zero].map(item => toBytes32(item));
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
                const skus = [Constants.Zero, Constants.One].map(item => toBytes32(item));
                const receipt = await this.contract.addInventorySkus(skus, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'InventorySkusAdded',
                    {
                        skus: skus,
                        added: [true, true]
                    });
            });
        });
    });

    describe('addSupportedPayoutTokens()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner })
        });

        it('reverts if called by any other than the owner', async function () {
            const tokens = [Constants.ZeroAddress];

            await expectRevert(
                this.contract.addSupportedPayoutTokens(tokens, { from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            await this.contract.unpause({ from: owner });

            const tokens = [Constants.ZeroAddress];

            await expectRevert(
                this.contract.addSupportedPayoutTokens(tokens, { from: owner }),
                'Pausable: not paused');
        });

        context('when adding zero tokens', function () {
            it('should emit the SupportedPayoutTokensAdded event', async function () {
                const tokens = [];
                const receipt = await this.contract.addSupportedPayoutTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPayoutTokensAdded',
                    {
                        tokens: tokens,
                        added: []
                    });
            });
        });

        context('when adding one token', function () {
            it('should emit the SupportedPayoutTokensAdded event', async function () {
                const tokens = [Constants.ZeroAddress];
                const receipt = await this.contract.addSupportedPayoutTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPayoutTokensAdded',
                    {
                        tokens: tokens,
                        added: [true]
                    });
            });
        });

        context('when adding multiple tokens', function () {
            it('should emit the SupportedPayoutTokensAdded event', async function () {
                const tokens = [Constants.ZeroAddress, EthAddress];
                const receipt = await this.contract.addSupportedPayoutTokens(tokens, { from: owner});

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SupportedPayoutTokensAdded',
                    {
                        tokens: tokens,
                        added: [true, true]
                    });
            });
        });
    });

    describe('setSkuTokenPrices()', function () {
        beforeEach(async function () {
            await this.contract.start({ from: owner });
            await this.contract.pause({ from: owner })
        });

        it('reverts if called by any other than the owner', async function () {
            const sku = this.sku;
            const tokens = [this.tokens[0]];
            const prices = [this.prices[0]];

            await expectRevert(
                this.contract.setSkuTokenPrices(sku, tokens, prices, { from: purchaser}),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract is not paused', async function () {
            await this.contract.unpause({ from: owner });

            const sku = this.sku;
            const tokens = [this.tokens[0]];
            const prices = [this.prices[0]];

            await expectRevert(
                this.contract.setSkuTokenPrices(sku, tokens, prices, { from: owner}),
                'Pausable: not paused');
        });

        beforeEach(async function () {
            this.sku = toBytes32(Constants.Zero);
            this.tokens = [Constants.ZeroAddress, EthAddress];
            this.prices = [ether('1'), ether('10')].map(item => item.toString());
            await this.contract.addInventorySkus([this.sku], { from: owner});
            await this.contract.addSupportedPayoutTokens(this.tokens, { from: owner});
        });

        context('when setting zero prices', function () {
            it('should emit the SkuTokenPricesUpdated event', async function () {
                const sku = this.sku;
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
                const sku = this.sku;
                const tokens = [this.tokens[0]];
                const prices = [this.prices[0]];
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
                const sku = this.sku;
                const tokens = [this.tokens[0], this.tokens[1]];
                const prices = [this.prices[0], this.prices[1]];
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

    describe('purchaseFor()', function () {
        const quantity = Constants.One;
        const paymentToken = EthAddress;

        context('when the sale has not started', function () {
            it('should revert', async function () {
                await expectRevert(
                    this.contract.purchaseFor(
                        purchaser,
                        paymentToken,
                        sku,
                        quantity,
                        extData,
                        { value: quantity }),
                    'Startable: not started');
            });
        });

        context('when the sale has started', function () {
            beforeEach(async function () {
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
                        extData,
                        { value: quantity }),
                    'Pausable: paused');
            });

            it('should call _purchaseFor()', async function () {
                const receipt = await this.contract.purchaseFor(
                    purchaser,
                    paymentToken,
                    sku,
                    quantity,
                    extData,
                    { value: quantity });

                expectEvent(
                    receipt,
                    'UnderscorePurchaseForCalled');
            });
        });
    });

    describe('_purchaseFor()', function () {
        beforeEach(async function () {
            const quantity = Constants.One;

            await this.contract.start({ from: owner });

            this.receipt = await this.contract.purchaseFor(
                purchaser,
                EthAddress,
                sku,
                quantity,
                extData,
                { value: quantity });
        });

        it('should call all of the lifecycle functions', async function () {
            expectEvent(
                this.receipt,
                'UnderscorePurchaseForCalled');
        });
    });

    describe('_validatePurchase()', function () {
        it('should revert if the purchase is invalid', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    purchaser,
                    EthAddress,
                    toBytes32(Constants.One),
                    Constants.One,
                    extData,
                    { value: Constants.One }),
                'SaleMock: invalid sku');
        });
    });

    describe('_calculatePrice()', function () {
        it('should return the correct price info', async function () {
            const quantity = Constants.One;

            const receipt = await this.contract.callUnderscoreCalculatePrice(
                purchaser,
                EthAddress,
                sku,
                quantity,
                extData,
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreCalculatePriceResult',
                { priceInfo: [ toBytes32(Constants.One) ] });
        });
    });

    describe('_transferFunds()', function () {
        it('should return the correct payment info', async function () {
            const quantity = Constants.One;

            const receipt = await this.contract.callUnderscoreTransferFunds(
                purchaser,
                EthAddress,
                sku,
                quantity,
                extData,
                [], // priceInfo
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreTransferFundsResult',
                { paymentInfo: [ toBytes32(Constants.Two) ] });
        });
    });

    describe('_deliverGoods()', function () {
        it('should return the correct delivery info', async function () {
            const quantity = Constants.One;

            const receipt = await this.contract.callUnderscoreDeliverGoods(
                purchaser,
                EthAddress,
                sku,
                quantity,
                extData,
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreDeliverGoodsResult',
                { deliveryInfo: [ toBytes32(Constants.Three) ] });
        });
    });

    describe('_finalizePurchase()', function () {
        it('should return the correct finalize info', async function () {
            const quantity = Constants.One;

            const receipt = await this.contract.callUnderscoreFinalizePurchase(
                purchaser,
                EthAddress,
                sku,
                quantity,
                extData,
                [], // priceInfo
                [], // paymentInfo
                [], // deliveryInfo
                { value: quantity });

            expectEvent(
                receipt,
                'UnderscoreFinalizePurchaseResult',
                { finalizeInfo: [ toBytes32(Constants.Four) ] });
        });
    });

    describe('_notifyPurchased()', function () {
        it('should emit the `Purchased` event', async function () {
            const quantity = Constants.One;
            const paymentToken = EthAddress;

            const receipt = await this.contract.callUnderscoreNotifyPurchased(
                purchaser,
                paymentToken,
                sku,
                quantity,
                extData,
                [
                    toBytes32(new BN(9)),
                    toBytes32(new BN(8)),
                    toBytes32(new BN(7)),
                    toBytes32(new BN(6))
                ],
                [
                    toBytes32(Constants.Five),
                    toBytes32(Constants.Four),
                    toBytes32(Constants.Three)
                ],
                [
                    toBytes32(Constants.Two),
                    toBytes32(Constants.One)
                ],
                [
                    toBytes32(Constants.Zero)
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
                    extData: [
                        extData[0],
                        toBytes32(new BN(9)),
                        toBytes32(new BN(8)),
                        toBytes32(new BN(7)),
                        toBytes32(new BN(6)),
                        toBytes32(Constants.Five),
                        toBytes32(Constants.Four),
                        toBytes32(Constants.Three),
                        toBytes32(Constants.Two),
                        toBytes32(Constants.One),
                        toBytes32(Constants.Zero)
                    ]
                });
        });
    });

    describe('_getPurchasedEventExtData()', function () {
        it('should return the correct Purchased event extra data', async function () {
            const quantity = Constants.One;

            const purchasedEventExtData =
                await this.contract.callUnderscoreGetPurchasedEventExtData(
                    purchaser,
                    EthAddress,
                    sku,
                    quantity,
                    extData);

            let offset = 0;

            purchasedEventExtData[offset].should.be.equal(extData[0]);

            for (let index = 0; index < 10; index++) {
                purchasedEventExtData[++offset].should.be.equal(toBytes32(index));
            }
        });
    });

    describe('_getTotalPriceInfo()', function () {
        it('should return the correct total price info', async function () {
            const quantity = Constants.One;

            const totalPriceInfo =
                await this.contract.callUnderscoreGetTotalPriceInfo(
                    purchaser,
                    EthAddress,
                    sku,
                    quantity,
                    extData);

            totalPriceInfo.length.should.be.equal(0);
        });
    });
});
