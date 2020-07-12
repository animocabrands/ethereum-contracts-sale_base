const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { toHex, padLeft } = require('web3-utils');

const Sale = artifacts.require('SaleMock');

contract('Sale', function ([
    _,
    payoutWallet,
    owner,
    operator,
    purchaser,
    ...accounts
]) {
    const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
    const Erc20TokenAddress = '0x3750bE154260872270EbA56eEf89E78E6E21C1D9'; // OMG
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
        this.contract = await Sale.new(
            payoutWallet,
            PayoutTokenAddress,
            { from: owner });
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

    describe('setPayoutToken()', function () {
        const [ notOwner ] = accounts;
        const newPayoutToken = Erc20TokenAddress;

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.contract.setPayoutToken(
                    newPayoutToken,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if set with the current payout token address', async function () {
            const currentPayoutTokenAddress = await this.contract.payoutToken();

            await expectRevert(
                this.contract.setPayoutToken(
                    currentPayoutTokenAddress,
                    { from: owner }),
                'Sale: identical payout token re-assignment');
        });

        it('should update the payout token used by the contract', async function () {
            const initialPayoutToken = await this.contract.payoutToken();
            initialPayoutToken.should.not.equal(newPayoutToken);

            await this.contract.setPayoutToken(newPayoutToken, { from: owner });

            const updatedPayoutToken = await this.contract.payoutToken();
            updatedPayoutToken.should.equal(newPayoutToken);
        });

        it('should call _setPayoutToken', async function () {
            const receipt = await this.contract.setPayoutToken(
                newPayoutToken,
                { from: owner });

            expectEvent(
                receipt,
                'PayoutTokenSet');
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
                        sku,
                        quantity,
                        paymentToken,
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
                        sku,
                        quantity,
                        paymentToken,
                        extData,
                        { value: quantity }),
                    'Pausable: paused');
            });

            it('should call _purchaseFor()', async function () {
                const receipt = await this.contract.purchaseFor(
                    purchaser,
                    sku,
                    quantity,
                    paymentToken,
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
                sku,
                quantity,
                EthAddress,
                extData,
                { value: quantity });
        });

        it('should call _validatePurchase()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreValidatePurchaseCalled');
        });

        it('should call _calculatePrice()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreCalculatePriceCalled');
        });

        it('should call _transferFunds()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreTransferFundsCalled');
        });

        it('should call _deliverGoods()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreDeliverGoodsCalled');
        });

        it('should call _finalizePurchase()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreFinalizePurchaseCalled');
        });

        it('should call _notifyPurchased()', async function () {
            expectEvent(
                this.receipt,
                'UnderscoreNotifyPurchasedCalled');
        });
    });

    describe('_validatePurchase()', function () {
        it('should revert if the purchase is invalid', async function () {
            await expectRevert(
                this.contract.callUnderscoreValidatePurchase(
                    purchaser,
                    toBytes32(Constants.One),
                    Constants.One,
                    EthAddress,
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
                sku,
                quantity,
                EthAddress,
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
                sku,
                quantity,
                EthAddress,
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
                sku,
                quantity,
                EthAddress,
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
                sku,
                quantity,
                EthAddress,
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
                sku,
                quantity,
                paymentToken,
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
                    sku,
                    quantity,
                    EthAddress,
                    extData);

            let offset = 0;

            purchasedEventExtData[offset].should.be.equal(extData[0]);

            for (let index = 0; index < 10; index++) {
                purchasedEventExtData[++offset].should.be.equal(toBytes32(index));
            }
        });
    });

    describe('_setPayoutToken()', function () {
        const newPayoutToken = Erc20TokenAddress;

        it('should set the payout token address', async function () {
            const beforePayoutTokenAddress = await this.contract.payoutToken();
            beforePayoutTokenAddress.should.not.be.equal(newPayoutToken);

            await this.contract.callUnderscoreSetPayoutToken(
                newPayoutToken,
                { from: owner });

            const afterPayoutTokenAddress = await this.contract.payoutToken();
            afterPayoutTokenAddress.should.be.equal(newPayoutToken);
        });

        it('should emit the PayoutTokenSet event', async function () {
            const receipt = await this.contract.callUnderscoreSetPayoutToken(
                newPayoutToken,
                { from: owner });

            expectEvent(
                receipt,
                'PayoutTokenSet',
                { payoutToken: newPayoutToken });
        });
    });
});
