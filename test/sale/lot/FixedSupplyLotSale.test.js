const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const InventoryIds = require('@animoca/blockchain-inventory_metadata').inventoryIds;
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { toHex, padLeft, toBN } = require('web3-utils');

const AssetsInventory = artifacts.require('AssetsInventoryMock');
const Sale = artifacts.require('FixedSupplyLotSaleMock');

contract('FixedSupplyLotSale', function ([
    _,
    payoutWallet,
    owner,
    operator,
    recipient,
    ...accounts
]) {
    const NF_MASK_LENGTH = 32;

    const nfTokenId1 = InventoryIds.makeNonFungibleTokenId(1, 1, NF_MASK_LENGTH);
    const nfTokenId2 = InventoryIds.makeNonFungibleTokenId(2, 1, NF_MASK_LENGTH);
    const nfTokenId3 = InventoryIds.makeNonFungibleTokenId(3, 1, NF_MASK_LENGTH);
    const ftCollectionId = InventoryIds.makeFungibleCollectionId(1);

    const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const lotId = Constants.Zero;
    const lotFungibleAmount = new BN('100');
    const lotPrice = ether('0.00001'); // must be at least 0.00001

    const sku = toBytes32(lotId);
    const extDataString = 'extData';

    const unknownLotId = Constants.One;

    function toBytes32(value) {
        return padLeft(toHex(value), 64);
    }

    async function shouldHaveStartedTheSale(state) {
        const startedAt = await this.sale.startedAt();

        if (state) {
            startedAt.should.be.bignumber.gt(Constants.Zero);
        } else {
            startedAt.should.be.bignumber.equal(Constants.Zero);
        }
    }

    async function shouldHavePausedTheSale(state) {
        const paused = await this.sale.paused();

        if (state) {
            paused.should.be.true;
        } else {
            paused.should.be.false;
        }
    }

    beforeEach(async function () {
        this.inventory = await AssetsInventory.new(NF_MASK_LENGTH, { from: owner });

        const sale = await Sale.new(
            payoutWallet,
            PayoutTokenAddress,
            ftCollectionId,
            this.inventory.address,
            { from: owner });

        await sale.createLot(
            lotId,
            [ nfTokenId1, nfTokenId2, nfTokenId3 ],
            lotFungibleAmount,
            lotPrice,
            { from: owner });

        this.sale = sale;
    });

    describe('setPayoutToken()', function () {
        it('should revert if if the payout token is the zero address', async function () {
            await expectRevert(
                this.sale.setPayoutToken(
                    Constants.ZeroAddress,
                    { from: owner }),
                'FixedSupplyLotSale: zero address payout token');
        });
    });

    describe('setFungibleTokenId()', function () {
        const [ notOwner ] = accounts;
        const newFungibleTokenId = new BN(InventoryIds.makeNonFungibleCollectionId(2, NF_MASK_LENGTH));

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.setFungibleTokenId(
                    newFungibleTokenId,
                    { from: notOwner }));
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert.unspecified(
                this.sale.setFungibleTokenId(
                    newFungibleTokenId,
                    { from: owner }));
        });

        it('should revert if set with the zero-address', async function () {
            await expectRevert.unspecified(
                this.sale.setFungibleTokenId(
                    Constants.ZeroAddress,
                    { from: owner }));
        });

        it('should revert if set with the current fungible token id', async function () {
            const currentFungibleTokenId = await this.sale._fungibleTokenId();
            await expectRevert.unspecified(
                this.sale.setFungibleTokenId(
                    currentFungibleTokenId,
                    { from: owner }));
        });

        it('should set the fungible token id', async function () {
            const beforeFungibleTokenId = await this.sale._fungibleTokenId();
            beforeFungibleTokenId.should.not.be.bignumber.equal(newFungibleTokenId);

            await this.sale.setFungibleTokenId(newFungibleTokenId, { from: owner });

            const afterFungibleTokenId = await this.sale._fungibleTokenId();
            afterFungibleTokenId.should.be.bignumber.equal(newFungibleTokenId);
        });
    });

    describe('setInventoryContract()', function () {
        const [ notOwner ] = accounts;

        beforeEach(async function () {
            const newMintableInventoryContract = await AssetsInventory.new(NF_MASK_LENGTH, { from: owner });
            this.newMintableInventoryContract = newMintableInventoryContract.address;
        });

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.setInventoryContract(
                    this.newMintableInventoryContract,
                    { from: notOwner }));
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert.unspecified(
                this.sale.setInventoryContract(
                    this.newMintableInventoryContract,
                    { from: owner }));
        });

        it('should revert if set with the zero-address', async function () {
            await expectRevert.unspecified(
                this.sale.setInventoryContract(
                    Constants.ZeroAddress,
                    { from: owner }));
        });

        it('should revert if set with the current mintable inventory contract', async function () {
            const currentMintableInventoryContract = await this.sale._inventoryContract();
            await expectRevert.unspecified(
                this.sale.setInventoryContract(
                    currentMintableInventoryContract,
                    { from: owner }));
        });

        it('should set the mintable inventory contract', async function () {
            const beforeMintableInventoryContract = await this.sale._inventoryContract();
            beforeMintableInventoryContract.should.not.be.equal(this.newMintableInventoryContract);

            await this.sale.setInventoryContract(this.newMintableInventoryContract, { from: owner });

            const afterMintableInventoryContract = await this.sale._inventoryContract();
            afterMintableInventoryContract.should.be.equal(this.newMintableInventoryContract);
        });
    });

    describe('createLot()', function () {
        const [ notOwner ] = accounts;
        const newLotId = Constants.Two;
        const newLotNonFungibleSupply = [
            new BN(InventoryIds.makeNonFungibleTokenId(1, 2, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(2, 2, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(3, 2, NF_MASK_LENGTH))
        ];
        const newLotFungibleAmount = lotFungibleAmount.muln(2);
        const newLotPrice = lotPrice.muln(2);

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.createLot(
                    newLotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    newLotPrice,
                    { from: notOwner }));
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert.unspecified(
                this.sale.createLot(
                    newLotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    newLotPrice,
                    { from: owner }));
        });

        it('should revert if the lot id is zero', async function () {
            await expectRevert.unspecified(
                this.sale.createLot(
                    '0',
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    newLotPrice,
                    { from: owner }));
        });

        it('should revert if the lot already exists', async function () {
            await expectRevert.unspecified(
                this.sale.createLot(
                    lotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    newLotPrice,
                    { from: owner }));
        });

        it('should create the lot', async function () {
            await this.sale.createLot(
                newLotId,
                newLotNonFungibleSupply,
                newLotFungibleAmount,
                newLotPrice,
                { from: owner });

            const lot = await this.sale._lots(newLotId);

            lot.exists.should.be.true;
            lot.fungibleAmount.should.be.bignumber.equal(newLotFungibleAmount);
            lot.price.should.be.bignumber.equal(newLotPrice);
            lot.numAvailable.should.be.bignumber.equal(new BN(newLotNonFungibleSupply.length));

            const lotNonFungibleSupply = await this.sale.getLotNonFungibleSupply(newLotId);
            const lotNonFungibleSupplyCount = lotNonFungibleSupply.length;

            lotNonFungibleSupplyCount.should.be.equal(newLotNonFungibleSupply.length);

            for (let index = 0; index < lotNonFungibleSupplyCount; index++) {
                lotNonFungibleSupply[index].should.be.bignumber.equal(newLotNonFungibleSupply[index]);
            }
        });

        it('should emit the LotCreated event', async function () {
            const receipt = await this.sale.createLot(
                newLotId,
                newLotNonFungibleSupply,
                newLotFungibleAmount,
                newLotPrice,
                { from: owner });

            // // deep array equality test for event arguments is not yet supported
            // // at the time of the creation of this test:
            // // https://github.com/OpenZeppelin/openzeppelin-test-helpers/pull/112
            // expectEvent(
            //     receipt,
            //     'LotCreated',
            //     {
            //         lotId: newLotId,
            //         nonFungibleTokens: newLotNonFungibleSupply,
            //         fungibleAmount: newLotFungibleAmount,
            //         price: newLotPrice
            //     });

            expectEvent(
                receipt,
                'LotCreated',
                {
                    lotId: newLotId,
                    fungibleAmount: newLotFungibleAmount,
                    price: newLotPrice
                });
        });
    });

    describe('updateLotNonFungibleSupply()', function () {
        const [ notOwner ] = accounts;
        const newLotNonFungibleSupply = [
            new BN(InventoryIds.makeNonFungibleTokenId(4, 1, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(5, 1, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(6, 1, NF_MASK_LENGTH))
        ];

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    newLotNonFungibleSupply,
                    { from: notOwner }));
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert.unspecified(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    newLotNonFungibleSupply,
                    { from: owner }));
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotNonFungibleSupply(
                    unknownLotId,
                    newLotNonFungibleSupply,
                    { from: owner }));
        });

        it('should revert if the new lot supply is empty', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    [],
                    { from: owner }));
        });

        it('should update the lot non-fungible supply', async function () {
            const lotBefore = await this.sale._lots(lotId);
            const numAvailableBefore = lotBefore.numAvailable;
            const nonFungibleSupplyBefore = await this.sale.getLotNonFungibleSupply(lotId);

            await this.sale.updateLotNonFungibleSupply(
                lotId,
                newLotNonFungibleSupply,
                { from: owner });

            const lotAfter = await this.sale._lots(lotId);
            const numAvailableAfter = lotAfter.numAvailable;
            const nonFungibleSupplyAfter = await this.sale.getLotNonFungibleSupply(lotId);

            numAvailableAfter.should.be.bignumber.equal(numAvailableBefore.add(new BN(newLotNonFungibleSupply.length)));

            for (let index = 0; index < newLotNonFungibleSupply.length; index++) {
                const offset = nonFungibleSupplyBefore.length + index;
                nonFungibleSupplyAfter[offset].should.be.bignumber.equal(newLotNonFungibleSupply[index]);
            }
        });

        it('should emit the LotNonFungibleSupplyUpdated event', async function () {
            const receipt = await this.sale.updateLotNonFungibleSupply(
                lotId,
                newLotNonFungibleSupply,
                { from: owner });

            // // deep array equality test for event arguments is not yet supported
            // // at the time of the creation of this test:
            // // https://github.com/OpenZeppelin/openzeppelin-test-helpers/pull/112
            // expectEvent(
            //     receipt,
            //     'LotNonFungibleSupplyUpdated',
            //     {
            //         lotId: lotId,
            //         nonFungibleTokens: newLotNonFungibleSupply
            //     });

            expectEvent(
                receipt,
                'LotNonFungibleSupplyUpdated',
                {
                    lotId: lotId
                });
        });
    });

    describe('updateLotFungibleAmount()', function () {
        const [ notOwner ] = accounts;
        const newLotFungibleAmount = lotFungibleAmount.muln(2);

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    newLotFungibleAmount,
                    { from: notOwner }));
        });

        it('should revert if the sale is not paused', async function () {
            await this.sale.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();

            await expectRevert.unspecified(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    newLotFungibleAmount,
                    { from: owner }));
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotFungibleAmount(
                    unknownLotId,
                    newLotFungibleAmount,
                    { from: owner }));
        });

        it('should revert if set with the current lot fungible amount', async function () {
            const lot = await this.sale._lots(lotId);
            const currentLotFungibleAmount = lot.fungibleAmount;
            await expectRevert.unspecified(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    currentLotFungibleAmount,
                    { from: owner }));
        });

        it('should update the lot fungible amount', async function () {
            const lotBefore = await this.sale._lots(lotId);
            const fungibleAmountBefore = lotBefore.fungibleAmount;
            fungibleAmountBefore.should.not.be.bignumber.equal(newLotFungibleAmount);

            const receipt = await this.sale.updateLotFungibleAmount(
                lotId,
                newLotFungibleAmount,
                { from: owner });

            const lotAfter = await this.sale._lots(lotId);
            const fungibleAmountAfter = lotAfter.fungibleAmount;
            fungibleAmountAfter.should.be.bignumber.equal(newLotFungibleAmount);
        });

        it('should emit the LotFungibleAmountUpdated event', async function () {
            const receipt = await this.sale.updateLotFungibleAmount(
                lotId,
                newLotFungibleAmount,
                { from: owner });

            expectEvent(
                receipt,
                'LotFungibleAmountUpdated',
                {
                    lotId: lotId,
                    fungibleAmount: newLotFungibleAmount
                });
        });
    });

    describe('updateLotPrice()', function () {
        const [ notOwner ] = accounts;
        const newLotPrice = lotPrice.muln(2);

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotPrice(
                    lotId,
                    newLotPrice,
                    { from: notOwner }));
        });

        it('should revert if the sale is not paused', async function () {
            await this.sale.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();

            await expectRevert.unspecified(
                this.sale.updateLotPrice(
                    lotId,
                    newLotPrice,
                    { from: owner }));
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert.unspecified(
                this.sale.updateLotPrice(
                    unknownLotId,
                    newLotPrice,
                    { from: owner }));
        });

        it('should revert if set with the current lot price', async function () {
            const lot = await this.sale._lots(lotId);
            const currentLotPrice = lot.price;
            await expectRevert.unspecified(
                this.sale.updateLotPrice(
                    lotId,
                    currentLotPrice,
                    { from: owner }));
        });

        it('should update the lot price', async function () {
            const lotBefore = await this.sale._lots(lotId);
            const lotPriceBefore = lotBefore.price;
            lotPriceBefore.should.not.be.bignumber.equal(newLotPrice);

            const receipt = await this.sale.updateLotPrice(
                lotId,
                newLotPrice,
                { from: owner });

            const lotAfter = await this.sale._lots(lotId);
            const lotPriceAfter = lotAfter.price;
            lotPriceAfter.should.be.bignumber.equal(newLotPrice);
        });

        it('should emit the LotPriceUpdated event', async function () {
            const receipt = await this.sale.updateLotPrice(
                lotId,
                newLotPrice,
                { from: owner });

            expectEvent(
                receipt,
                'LotPriceUpdated',
                {
                    lotId: lotId,
                    price: newLotPrice
                });
        });
    });

    describe('peekLotAvailableNonFungibleSupply()', function () {
        async function shouldReturnAvailableNonFugibleTokens(count) {
            const availableNonFungibleTokens = await this.sale.peekLotAvailableNonFungibleSupply(
                lotId,
                count);

            if (count.gt(this.numAvailable)) {
                count = this.numAvailable;
            }

            (new BN(availableNonFungibleTokens.length)).should.be.bignumber.equal(count);

            const nonFungibleSupply = await this.sale.getLotNonFungibleSupply(lotId);
            const offset = nonFungibleSupply.length - this.numAvailable.toNumber();

            for (let index = 0; index < count.toNumber(); index++) {
                const position = offset + index;
                availableNonFungibleTokens[index].should.be.bignumber.equal(nonFungibleSupply[position]);
            }
        }

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert.unspecified(
                this.sale.peekLotAvailableNonFungibleSupply(
                    unknownLotId,
                    Constants.One));
        });

        context('when available supply == 0', function () {
            beforeEach(async function () {
                await this.sale.setLotNumAvailable(lotId, Constants.Zero);
                const lot = await this.sale._lots(lotId);
                this.numAvailable = lot.numAvailable;
            });

            context('when count == available supply', function () {
                it('should return {count} available non-fungible tokens', async function () {
                    await shouldReturnAvailableNonFugibleTokens.bind(
                        this,
                        this.numAvailable)();
                });
            });

            context('when count > available supply', function () {
                it('should return {available} available non-fungible tokens', async function () {
                    await shouldReturnAvailableNonFugibleTokens.bind(
                        this,
                        this.numAvailable.add(Constants.One))();
                });
            })
        });

        context('when available supply > 0', function () {
            beforeEach(async function () {
                const lot = await this.sale._lots(lotId);
                this.numAvailable = lot.numAvailable;
            });

            context('when count < available supply', function () {
                it('should return {count} available non-fungible tokens', async function () {
                    await shouldReturnAvailableNonFugibleTokens.bind(
                        this,
                        this.numAvailable.sub(Constants.One))();
                });
            });

            context('when count == available supply', function () {
                it('should return {count} available non-fungible tokens', async function () {
                    await shouldReturnAvailableNonFugibleTokens.bind(
                        this,
                        this.numAvailable)();
                });
            });

            context('when count > available supply', function () {
                it('should return {available} available non-fungible tokens', async function () {
                    await shouldReturnAvailableNonFugibleTokens.bind(
                        this,
                        this.numAvailable.add(Constants.One))();
                });
            })
        });
    });

    describe('_validatePurchase()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        async function shouldRevert(recipient, lotId, quantity, tokenAddress, error, txParams = {}) {
            await expectRevert(
                this.sale.callUnderscoreValidatePurchase(
                    recipient,
                    toBytes32(lotId),
                    quantity,
                    tokenAddress,
                    [ extDataString ].map(item => toBytes32(item)),
                    txParams),
                error);
        }

        async function shouldRevertWithValidatedQuantity(recipient, lotId, quantity, tokenAddress, error, txParams = {}) {
            const lot = await this.sale._lots(lotId);

            if (lot.exists) {
                (quantity.gt(Constants.Zero) && quantity.lte(lot.numAvailable)).should.be.true;
            }

            await shouldRevert.bind(this, recipient, lotId, quantity, tokenAddress, error, txParams)();
        }

        it('should revert if the recipient is the zero-address', async function () {
            await shouldRevertWithValidatedQuantity.bind(
                this,
                Constants.ZeroAddress,
                lotId,
                quantity,
                tokenAddress,
                'FixedSupplyLotSale: zero address purchaser',
                { from: operator })();
        });

        it('should revert if the recipient is the sale contract address', async function () {
            await shouldRevertWithValidatedQuantity.bind(
                this,
                this.sale.address,
                lotId,
                quantity,
                tokenAddress,
                'FixedSupplyLotSale: contract address purchaser',
                { from: operator })();
        });

        it('should revert if the lot doesnt exist', async function () {
            await shouldRevertWithValidatedQuantity.bind(
                this,
                recipient,
                unknownLotId,
                quantity,
                tokenAddress,
                'FixedSupplyLotSale: non-existent lot',
                { from: operator })();
        });

        it('should revert if the purchase quantity is zero', async function () {
            const quantity = Constants.Zero;

            await shouldRevert.bind(
                this,
                recipient,
                lotId,
                Constants.Zero,
                tokenAddress,
                'FixedSupplyLotSale: zero quantity purchase',
                { from: operator })();
        });

        it('should revert if the purchase token address is the zero-address', async function () {
            await shouldRevertWithValidatedQuantity.bind(
                this,
                recipient,
                lotId,
                quantity,
                Constants.ZeroAddress,
                'FixedSupplyLotSale: zero address payment token',
                { from: operator })();
        });

        it('should revert if the purchase quantity > number of Lot items available for sale', async function () {
            const lot = await this.sale._lots(lotId);

            await shouldRevert.bind(
                this,
                recipient,
                lotId,
                lot.numAvailable.add(Constants.One),
                tokenAddress,
                'FixedSupplyLotSale: insufficient available lot supply',
                { from: operator })();
        });
    });

    describe('_calculatePrice()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);

            const pricingInfoReceipt = await this.sale.callUnderscoreCalculatePrice(
                recipient,
                sku,
                quantity,
                tokenAddress,
                [], // extData
                { from: operator });

            const calculatePriceEvents = await this.sale.getPastEvents(
                'UnderscoreCalculatePriceResult',
                {
                    fromBlock: 0,
                    toBlock: 'latest'
                });

            this.calculatePriceResult = calculatePriceEvents[0].args;
        });

        it('should return correct total price pricing info', async function () {
            const expectedTotalPrice = this.lot.price.mul(quantity);
            const actualTotalPrice = toBN(this.calculatePriceResult.priceInfo[0]);
            expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
        });

        it('should return correct total discounts pricing info', async function () {
            const expectedTotalDiscounts = Constants.Zero;
            const actualTotalDiscounts = toBN(this.calculatePriceResult.priceInfo[1]);
            expectedTotalDiscounts.should.be.bignumber.equal(actualTotalDiscounts);
        });
    });

    describe('_deliverGoods()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);
            this.nonFungibleSupply = await this.sale.peekLotAvailableNonFungibleSupply(lotId, quantity);

            await this.sale.callUnderscoreDeliverGoods(
                recipient,
                sku,
                quantity,
                tokenAddress,
                [], // extData
                { from: operator });

            const deliverGoodsEvents = await this.sale.getPastEvents(
                'UnderscoreDeliverGoodsResult',
                {
                    fromBlock: 0,
                    toBlock: 'latest'
                });

            this.result = deliverGoodsEvents[0].args;
        });

        it('should return correct number of non-fungible tokens delivery info', async function () {
            toBN(this.result.deliveryInfo[0]).should.be.bignumber.equal(quantity);
        });

        it('should return correct non-fungible tokens delivery info', async function () {
            for (let index = 0; index < quantity.toNumber(); index++) {
                toBN(this.result.deliveryInfo[index + 1]).should.be.bignumber.equal(this.nonFungibleSupply[index]);
            }
        });

        it('should return correct total fungible amount delivery info', async function () {
            toBN(this.result.deliveryInfo[quantity.toNumber() + 1]).should.be.bignumber.equal(quantity.mul(this.lot.fungibleAmount));
        });
    });

    describe('_finalizePurchase()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);

            await this.sale.callUnderscoreFinalizePurchase(
                recipient,
                sku,
                quantity,
                tokenAddress,
                [], // extData
                [], // priceInfo
                [], // paymentInfo
                [], // deliveryInfo
                {
                    from: operator
                });

            const finalizePurchaseEvents = await this.sale.getPastEvents(
                'UnderscoreFinalizePurchaseResult',
                {
                    fromBlock: 0,
                    toBlock: 'latest'
                });

            this.result = finalizePurchaseEvents[0].args;
        });

        it('should update the number of lot items available for sale', async function () {
            const lot = await this.sale._lots(lotId);
            lot.numAvailable.should.be.bignumber.equals(
                this.lot.numAvailable.sub(quantity));
        });

        it('should return correct finalize info', async function () {
            this.result.finalizeInfo.length.should.equal(0);
        });
    });

    describe('_getPrice()', function () {
        const quantity = Constants.One;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);

            this.priceInfo = await this.sale.callUnderscoreGetPrice(
                recipient,
                lotId,
                quantity);
        });

        it('should return correct total price pricing info', async function () {
            const expectedTotalPrice = this.lot.price.mul(quantity);
            const actualTotalPrice = this.priceInfo.totalPrice;
            expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
        });

        it('should return correct total discounts pricing info', async function () {
            const expectedTotalDiscounts = Constants.Zero;
            const actualTotalDiscounts = this.priceInfo.totalDiscounts;
            expectedTotalDiscounts.should.be.bignumber.equal(actualTotalDiscounts);
        });
    });
});
