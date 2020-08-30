const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const InventoryIds = require('@animoca/blockchain-inventory_metadata').inventoryIds;
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { toBN } = require('web3-utils');

const { stringToBytes32, uintToBytes32, bytes32ArrayToBytes } = require('../utils/bytes32');

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

    const sku = uintToBytes32(lotId);
    const userData = bytes32ArrayToBytes([ stringToBytes32('userData') ]);

    const unknownLotId = Constants.One;

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
            ftCollectionId,
            this.inventory.address,
            { from: owner });

        await sale.createLot(
            lotId,
            [ nfTokenId1, nfTokenId2, nfTokenId3 ],
            lotFungibleAmount,
            { from: owner });

        await sale.addPaymentTokens(
            [ PayoutTokenAddress],
            { from: owner });

        await sale.setSkuTokenPrices(
            sku,
            [ PayoutTokenAddress ],
            [ lotPrice ],
            { from: owner });

        this.sale = sale;
    });

    describe('setFungibleTokenId()', function () {
        const [ notOwner ] = accounts;
        const newFungibleTokenId = new BN(InventoryIds.makeNonFungibleCollectionId(2, NF_MASK_LENGTH));

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.sale.setFungibleTokenId(
                    newFungibleTokenId,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert(
                this.sale.setFungibleTokenId(
                    newFungibleTokenId,
                    { from: owner }),
                'Startable: started');
        });

        it('should revert if set with the zero-address', async function () {
            await expectRevert(
                this.sale.setFungibleTokenId(
                    Constants.ZeroAddress,
                    { from: owner }),
                'FixedSupplyLotSale: zero fungible token ID');
        });

        it('should revert if set with the current fungible token id', async function () {
            const currentFungibleTokenId = await this.sale._fungibleTokenId();
            await expectRevert(
                this.sale.setFungibleTokenId(
                    currentFungibleTokenId,
                    { from: owner }),
                'FixedSupplyLotSale: duplicate assignment');
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
            await expectRevert(
                this.sale.setInventoryContract(
                    this.newMintableInventoryContract,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert(
                this.sale.setInventoryContract(
                    this.newMintableInventoryContract,
                    { from: owner }),
                'Startable: started');
        });

        it('should revert if set with the zero-address', async function () {
            await expectRevert(
                this.sale.setInventoryContract(
                    Constants.ZeroAddress,
                    { from: owner }),
                'FixedSupplyLotSale: zero inventory contract');
        });

        it('should revert if set with the current mintable inventory contract', async function () {
            const currentMintableInventoryContract = await this.sale._inventoryContract();
            await expectRevert(
                this.sale.setInventoryContract(
                    currentMintableInventoryContract,
                    { from: owner }),
                'FixedSupplyLotSale: duplicate assignment');
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
        const newSku = uintToBytes32(newLotId);
        const newLotNonFungibleSupply = [
            new BN(InventoryIds.makeNonFungibleTokenId(1, 2, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(2, 2, NF_MASK_LENGTH)),
            new BN(InventoryIds.makeNonFungibleTokenId(3, 2, NF_MASK_LENGTH))
        ];
        const newLotFungibleAmount = lotFungibleAmount.muln(2);

        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.sale.createLot(
                    newLotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert(
                this.sale.createLot(
                    newLotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    { from: owner }),
                'Startable: started');
        });

        it('should revert if the lot id is zero', async function () {
            await expectRevert(
                this.sale.createLot(
                    '0',
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    { from: owner }),
                'FixedSupplyLotSale: lot exists');
        });

        it('should revert if the lot already exists', async function () {
            await expectRevert(
                this.sale.createLot(
                    lotId,
                    newLotNonFungibleSupply,
                    newLotFungibleAmount,
                    { from: owner }),
                'FixedSupplyLotSale: lot exists');
        });

        it('should create the lot', async function () {
            await this.sale.createLot(
                newLotId,
                newLotNonFungibleSupply,
                newLotFungibleAmount,
                { from: owner });

            const exists = await this.sale.hasInventorySku(newSku);
            exists.should.be.true;

            const lot = await this.sale._lots(newLotId);

            lot.fungibleAmount.should.be.bignumber.equal(newLotFungibleAmount);
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
                    fungibleAmount: newLotFungibleAmount
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
            await expectRevert(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    newLotNonFungibleSupply,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    newLotNonFungibleSupply,
                    { from: owner }),
                'Startable: started');
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert(
                this.sale.updateLotNonFungibleSupply(
                    unknownLotId,
                    newLotNonFungibleSupply,
                    { from: owner }),
                'FixedSupplyLotSale: non-existent lot');
        });

        it('should revert if the new lot supply is empty', async function () {
            await expectRevert(
                this.sale.updateLotNonFungibleSupply(
                    lotId,
                    [],
                    { from: owner }),
                'FixedSupplyLotSale: zero length non-fungible supply');
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
            await expectRevert(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    newLotFungibleAmount,
                    { from: notOwner }),
                'Ownable: caller is not the owner');
        });

        it('should revert if the sale is not paused', async function () {
            await this.sale.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();

            await expectRevert(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    newLotFungibleAmount,
                    { from: owner }),
                'Pausable: not paused');
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert(
                this.sale.updateLotFungibleAmount(
                    unknownLotId,
                    newLotFungibleAmount,
                    { from: owner }),
                'FixedSupplyLotSale: non-existent lot');
        });

        it('should revert if set with the current lot fungible amount', async function () {
            const lot = await this.sale._lots(lotId);
            const currentLotFungibleAmount = lot.fungibleAmount;
            await expectRevert(
                this.sale.updateLotFungibleAmount(
                    lotId,
                    currentLotFungibleAmount,
                    { from: owner }),
                'FixedSupplyLotSale: duplicate assignment');
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
            await expectRevert(
                this.sale.peekLotAvailableNonFungibleSupply(
                    unknownLotId,
                    Constants.One),
                'FixedSupplyLotSale: non-existent lot');
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

        it('should revert if the purchase quantity > number of Lot items available for sale', async function () {
            const lot = await this.sale._lots(lotId);

            await expectRevert(
                this.sale.callUnderscoreValidatePurchase(
                    recipient,
                    tokenAddress,
                    sku,
                    lot.numAvailable.add(quantity),
                    userData,
                    { from: operator }),
                'FixedSupplyLotSale: insufficient available lot supply');
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
                tokenAddress,
                sku,
                quantity,
                [], // userData
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

    // describe('_finalizePurchase()', function () {
    //     const quantity = Constants.One;
    //     const tokenAddress = EthAddress;

    //     beforeEach(async function () {
    //         this.lot = await this.sale._lots(lotId);

    //         await this.sale.callUnderscoreFinalizePurchase(
    //             recipient,
    //             tokenAddress,
    //             sku,
    //             quantity,
    //             [], // userData
    //             [], // priceInfo
    //             [], // paymentInfo
    //             [], // deliveryInfo
    //             {
    //                 from: operator
    //             });

    //         const finalizePurchaseEvents = await this.sale.getPastEvents(
    //             'UnderscoreFinalizePurchaseResult',
    //             {
    //                 fromBlock: 0,
    //                 toBlock: 'latest'
    //             });

    //         this.result = finalizePurchaseEvents[0].args;
    //     });

    //     it('should update the number of lot items available for sale', async function () {
    //         const lot = await this.sale._lots(lotId);
    //         lot.numAvailable.should.be.bignumber.equals(
    //             this.lot.numAvailable.sub(quantity));
    //     });

    //     it('should return correct finalize info', async function () {
    //         this.result.finalizeInfo.length.should.equal(0);
    //     });
    // });
});
