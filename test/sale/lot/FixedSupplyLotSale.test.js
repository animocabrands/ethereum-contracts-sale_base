const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const InventoryIds = require('@animoca/blockchain-inventory_metadata').inventoryIds;
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { shouldBeEqualWithProportionalPrecision } = require('@animoca/ethereum-contracts-core_library').fixtures

const ERC20 = artifacts.require('IERC20');
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

    const nftCollectionId = InventoryIds.makeNonFungibleCollectionId(1, NF_MASK_LENGTH);
    const nfTokenId1 = InventoryIds.makeNonFungibleTokenId(1, 1, NF_MASK_LENGTH);
    const nfTokenId2 = InventoryIds.makeNonFungibleTokenId(2, 1, NF_MASK_LENGTH);
    const nfTokenId3 = InventoryIds.makeNonFungibleTokenId(3, 1, NF_MASK_LENGTH);
    const ftCollectionId = InventoryIds.makeFungibleCollectionId(1);

    const KyberProxyAddress = '0xd3add19ee7e5287148a5866784aE3C55bd4E375A'; // Ganache snapshot
    const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
    const Erc20TokenAddress = '0x3750bE154260872270EbA56eEf89E78E6E21C1D9'; // OMG
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const lotId = Constants.Zero;
    const lotFungibleAmount = new BN('100');
    const lotPrice = ether('0.00001'); // must be at least 0.00001

    const unknownLotId = Constants.One;

    function shouldBeEqualWithinDeviationPercent(expected, actual, significand, orderOfMagnitude = 0) {
        if (expected.isZero()) {
            actual.isZero().should.be.true;
        } else {
            // const delta = expected.sub(actual).abs();
            // const numerator = delta.muln(100).mul(new BN(10).pow(new BN(-1 * orderOfMagnitude)));
            // const actualPercentDeviation = numerator.div(expected);
            // actualPercentDeviation.lte(significand).should.be.true;

            // e.g. 5% deviation
            //      => 1/N = 0.05
            //      => 1 / 0.05 = N
            //      => 100 / 5 = N
            //      => 100 / (5 * 10 ^ 0) = N
            //      => 100 / (significand * 10 ^ orderOfMagnitude) = N
            //      => (100 * 10 ^ (-1 * orderOfMagnitude)) / significand = N
            const numerator = new BN(100).mul(new BN(10).pow(new BN(-1 * orderOfMagnitude)));
            const denominator = new BN(significand);
            const divisor = numerator.div(denominator);
            shouldBeEqualWithProportionalPrecision(actual, expected, divisor);
        }
    }

    async function shouldHaveStartedTheSale(state) {
        const startedAt = await this.sale._startedAt();

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

    async function shouldMintPurchasedTokens(lotId, quantity) {
        for (let index = 0; index < quantity.toNumber(); index++) {
            const nonFungibleTokenId = this.nonFungibleTokens[index];

            await expectEvent.inTransaction(
                this.receipt.tx,
                this.inventory,
                'Transfer',
                {
                    _from: Constants.ZeroAddress,
                    _to: recipient,
                    _tokenId: nonFungibleTokenId
                });

            await expectEvent.inTransaction(
                this.receipt.tx,
                this.inventory,
                'TransferSingle',
                {
                    _operator: this.sale.address,
                    _from: Constants.ZeroAddress,
                    _to: recipient,
                    _id: nonFungibleTokenId,
                    _value: Constants.One
                });

            await expectEvent.inTransaction(
                this.receipt.tx,
                this.inventory,
                'URI',
                {
                    _id: nonFungibleTokenId
                });

            this.nftExists[nonFungibleTokenId].should.be.false;
            const nftExists = await this.inventory.exists(nonFungibleTokenId);
            nftExists.should.be.true;

            const nftOwnerOf = await this.inventory.ownerOf(nonFungibleTokenId);
            nftOwnerOf.should.be.equal(recipient);
        }

        const recipientNftCollectionBalance = await this.inventory.balanceOf(
            recipient,
            nftCollectionId);
        recipientNftCollectionBalance.should.be.bignumber.equal(
            this.recipientNftCollectionBalance.add(quantity));

        const recipientNftBalance = await this.inventory.balanceOf(
            recipient);
        recipientNftBalance.should.be.bignumber.equal(
            this.recipientNftBalance.add(quantity));

        await expectEvent.inTransaction(
            this.receipt.tx,
            this.inventory,
            'TransferSingle',
            {
                _operator: this.sale.address,
                _from: Constants.ZeroAddress,
                _to: recipient,
                _id: ftCollectionId,
                _value: this.lot.fungibleAmount.mul(quantity)
            });

        const recipientFtCollectionBalance = await this.inventory.balanceOf(
            recipient,
            ftCollectionId);
        recipientFtCollectionBalance.should.be.bignumber.equal(
            this.recipientFtCollectionBalance.add(
                this.lot.fungibleAmount.mul(quantity)));
    }

    beforeEach(async function () {
        this.inventory = await AssetsInventory.new(NF_MASK_LENGTH, { from: owner });
        await this.inventory.createCollection(nftCollectionId, { from: owner });
        await this.inventory.createCollection(ftCollectionId, { from: owner });

        const sale = await Sale.new(
            KyberProxyAddress,
            payoutWallet,
            PayoutTokenAddress,
            ftCollectionId,
            this.inventory.address,
            { from: owner });

        await this.inventory.addMinter(sale.address, { from: owner });

        await sale.createLot(
            lotId,
            [ nfTokenId1, nfTokenId2, nfTokenId3 ],
            lotFungibleAmount,
            lotPrice,
            { from: owner });

        this.sale = sale;
    });

    describe('setPayoutWallet()', function () {
        const [ newPayoutWallet, notOwner ] = accounts;

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.setPayoutWallet(
                    newPayoutWallet,
                    { from: notOwner }));
        });

        it('should revert if set with the zero-address', async function () {
            await expectRevert.unspecified(
                this.sale.setPayoutWallet(
                    Constants.ZeroAddress,
                    { from: owner }));
        });

        it('should revert if set with the sale contract address', async function () {
            await expectRevert.unspecified(
                this.sale.setPayoutWallet(
                    this.sale.address,
                    { from: owner }));
        });

        it('should revert if set with the current payout wallet', async function () {
            const currentPayoutWallet = await this.sale.payoutWallet();
            await expectRevert.unspecified(
                this.sale.setPayoutWallet(
                    currentPayoutWallet,
                    { from: owner }));
        });

        it('should set the payout wallet', async function () {
            const beforePayoutWallet = await this.sale.payoutWallet();
            beforePayoutWallet.should.not.be.equal(newPayoutWallet);

            await this.sale.setPayoutWallet(newPayoutWallet, { from: owner });

            const afterPayoutWallet = await this.sale.payoutWallet();
            afterPayoutWallet.should.be.equal(newPayoutWallet);
        });
    });

    describe('setPayoutTokenAddress()', function () {
        const [ notOwner ] = accounts;
        const newPayoutTokenAddress = Erc20TokenAddress;

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.setPayoutTokenAddress(
                    newPayoutTokenAddress,
                    { from: notOwner }));
        });

        it('should revert if the lot sale is not paused', async function () {
            await this.sale.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();

            await expectRevert.unspecified(
                this.sale.setPayoutTokenAddress(
                    newPayoutTokenAddress,
                    { from: owner }));
        })

        it('should revert if set with the zero-address', async function () {
            await expectRevert.unspecified(
                this.sale.setPayoutTokenAddress(
                    Constants.ZeroAddress,
                    { from: owner }));
        });

        it('should revert if set with the current payout token address', async function () {
            const currentPayoutTokenAddress = await this.sale._payoutTokenAddress();
            await expectRevert.unspecified(
                this.sale.setPayoutTokenAddress(
                    currentPayoutTokenAddress,
                    { from: owner }));
        });

        it('should set the payout token address', async function () {
            const beforePayoutTokenAddress = await this.sale._payoutTokenAddress();
            beforePayoutTokenAddress.should.not.be.equal(newPayoutTokenAddress);

            await this.sale.setPayoutTokenAddress(newPayoutTokenAddress, { from: owner });

            const afterPayoutTokenAddress = await this.sale._payoutTokenAddress();
            afterPayoutTokenAddress.should.be.equal(newPayoutTokenAddress);
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

    describe('start()', function () {
        const [ notOwner ] = accounts;

        it('should revert if not called by the owner', async function () {
            await expectRevert.unspecified(
                this.sale.start({ from: notOwner }));
        });

        it('should revert if the lot sale has started', async function () {
            await this.sale.start({ from: owner });

            await shouldHaveStartedTheSale.bind(this, true)();

            await expectRevert.unspecified(
                this.sale.start({ from: owner }));
        });

        it('should set the lot sale start timestamp', async function () {
            const beforeStartedAt = await this.sale._startedAt();
            beforeStartedAt.should.be.bignumber.equal(Constants.Zero);

            await this.sale.start({ from: owner });

            const afterStartedAt = await this.sale._startedAt();
            afterStartedAt.should.be.bignumber.gt(Constants.Zero);
        });

        it('should unpause the lot sale', async function () {
            await shouldHavePausedTheSale.bind(this, true)();

            await this.sale.start({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();
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

    describe('purchaseFor()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        async function shouldRevert(recipient, lotId, quantity, tokenAddress, priceInfo, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            }

            await expectRevert.unspecified(
                this.sale.purchaseFor(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    priceInfo.totalPrice,
                    priceInfo.minConversionRate,
                    '',
                    txParams));
        }

        async function shouldRevertWithValidatedQuantity(recipient, lotId, quantity, tokenAddress, priceInfo, txParams = {}) {
            const lot = await this.sale._lots(lotId);

            if (lot.exists) {
                (quantity.gt(Constants.Zero) && quantity.lte(lot.numAvailable)).should.be.true;
            }

            await shouldRevert.bind(this, recipient, lotId, quantity, tokenAddress, priceInfo, txParams)();
        }

        it('should revert if the sale has not started', async function () {
            await shouldHaveStartedTheSale.bind(this, false)();

            await this.sale.unpause({ from: owner });

            await shouldHavePausedTheSale.bind(this, false)();

            await shouldRevertWithValidatedQuantity.bind(
                this,
                recipient,
                lotId,
                quantity,
                tokenAddress,
                null,
                { from: operator })();
        });

        context('when the sale has started', function () {
            function testShouldRevertIfPurchasingForLessThanTheTotalPrice(recipient, lotId, quantity, tokenAddress) {
                it('should revert if purchasing for less than the total price', async function () {
                    const priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);
                    priceInfo.totalPrice = priceInfo.totalPrice.divn(2);

                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        priceInfo,
                        { from: operator })();
                });
            }

            function testShouldRevertPurchaseTokenTransferFrom(lotId, quantity, tokenAddress, tokenBalance) {
                context('when the sale contract has a sufficient purchase allowance from the operator', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                    });

                    it('should revert if the operator has an insufficient purchase balance', async function () {
                        await shouldRevertWithValidatedQuantity.bind(
                            this,
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            null,
                            { from: operator })();
                    });
                });

                context('when the operator has a sufficient purchase balance', function () {
                    beforeEach(async function () {
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                    });

                    afterEach(async function () {
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    it('should revert if the sale contract has an insufficient purchase allowance from the operator', async function () {
                        await shouldRevertWithValidatedQuantity.bind(
                            this,
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            null,
                            { from: operator })();
                    });
                });
            }

            function testShouldCallPurchaseFor() {
                it('should successfully call _purchaseFor()', async function () {
                    expectEvent(
                        this.receipt,
                        'UnderscorePurchaseForCalled');
                });
            }

            function testShouldUpdateAvailableLotItems(lotId, quantity) {
                it('should update the number of lot items available for sale', async function () {
                    const lot = await this.sale._lots(lotId);
                    lot.numAvailable.should.be.bignumber.equals(
                        this.lot.numAvailable.sub(quantity));
                });
            }

            beforeEach(async function () {
                this.erc20Payout = await ERC20.at(PayoutTokenAddress);

                this.lot = await this.sale._lots(lotId);

                await this.sale.start({ from: owner });
            });

            it('should revert if the sale is paused', async function () {
                await shouldHaveStartedTheSale.bind(this, true)();

                await this.sale.pause({ from: owner });

                await shouldHavePausedTheSale.bind(this, true)();

                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    null,
                    { from: operator })();
            });

            it('should revert if the recipient is the zero-address', async function () {
                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    Constants.ZeroAddress,
                    lotId,
                    quantity,
                    tokenAddress,
                    null,
                    { from: operator })();
            });

            it('should revert if the recipient is the sale contract address', async function () {
                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    this.sale.address,
                    lotId,
                    quantity,
                    tokenAddress,
                    null,
                    { from: operator })();
            });

            it('should revert if the lot doesnt exist', async function () {
                // pre-emptive revert caused by the call to getPrice()
                await expectRevert.unspecified(
                    shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        unknownLotId,
                        quantity,
                        tokenAddress,
                        null,
                        { from: operator })());
            });

            it('should revert if the purchase quantity is zero', async function () {
                const quantity = Constants.Zero;

                await shouldRevert.bind(
                    this,
                    recipient,
                    lotId,
                    Constants.Zero,
                    tokenAddress,
                    null,
                    { from: operator })();
            });

            it('should revert if the purchase token address is the zero-address', async function () {
                // pre-emptive revert caused by the call to getPrice()
                await expectRevert.unspecified(
                    shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        null,
                        Constants.ZeroAddress,
                        { from: operator })());
            });

            it('should revert if the purchase quantity > number of Lot items available for sale', async function () {
                const lot = await this.sale._lots(lotId);

                await shouldRevert.bind(
                    this,
                    recipient,
                    lotId,
                    lot.numAvailable.add(Constants.One),
                    tokenAddress,
                    null,
                    { from: operator })();
            });

            context('when the purchase token currency is ETH', function () {
                it('should revert if the transaction contains an insufficient amount of ETH', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        null,
                        {
                            from: operator,
                            value: Constants.Zero
                        })();
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        this.priceInfo = await this.sale.getPrice(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress);
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                            this.receipt = await this.sale.purchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                maxTokenAmount,
                                this.priceInfo.minConversionRate,
                                'extData',
                                {
                                    from: operator,
                                    value: maxTokenAmount
                                });
                        });

                        testShouldCallPurchaseFor.bind(this)();

                        testShouldUpdateAvailableLotItems.bind(
                            this,
                            lotId,
                            quantity)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.purchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice,
                                this.priceInfo.minConversionRate,
                                'extData',
                                {
                                    from: operator,
                                    value: this.priceInfo.totalPrice
                                });
                        });

                        testShouldCallPurchaseFor.bind(this)();

                        testShouldUpdateAvailableLotItems.bind(
                            this,
                            lotId,
                            quantity)();
                    });
                });
            });

            context('when the purchase token currency is an ERC20 token', function () {
                const tokenBalance = ether(Constants.One);

                context('when the purchase token currency is not the payout token currency', function () {
                    const tokenAddress = Erc20TokenAddress;

                    beforeEach(async function () {
                        this.erc20 = await ERC20.at(tokenAddress);

                        this.priceInfo = await this.sale.getPrice(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress);
                    });

                    it('should revert if the transaction contains any ETH', async function () {
                        await shouldRevertWithValidatedQuantity.bind(
                            this,
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            null,
                            {
                                from: operator,
                                value: Constants.One
                            })();
                    });

                    testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress)();

                    testShouldRevertPurchaseTokenTransferFrom.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress,
                        tokenBalance)();

                    context('when sucessfully making a purchase', function () {
                        beforeEach(async function () {
                            await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                            await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                        });

                        afterEach(async function () {
                            await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                            const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                            await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                        });

                        context('when spending with more than the total price', function () {
                            beforeEach(async function () {
                                const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                                this.receipt = await this.sale.purchaseFor(
                                    recipient,
                                    lotId,
                                    quantity,
                                    tokenAddress,
                                    maxTokenAmount,
                                    this.priceInfo.minConversionRate,
                                    'extData',
                                    { from: operator });
                            });

                            testShouldCallPurchaseFor.bind(this)();

                            testShouldUpdateAvailableLotItems.bind(
                                this,
                                lotId,
                                quantity)();
                        });

                        context('when spending the exact total price amount', function () {
                            beforeEach(async function () {
                                this.receipt = await this.sale.purchaseFor(
                                    recipient,
                                    lotId,
                                    quantity,
                                    tokenAddress,
                                    this.priceInfo.totalPrice,
                                    this.priceInfo.minConversionRate,
                                    'extData',
                                    { from: operator });
                            });

                            testShouldCallPurchaseFor.bind(this)();

                            testShouldUpdateAvailableLotItems.bind(
                                this,
                                lotId,
                                quantity)();
                        });
                    });
                });

                context('when the purchase token currency is the payout token currency', function () {
                    const tokenAddress = PayoutTokenAddress;

                    beforeEach(async function () {
                        this.erc20 = await ERC20.at(tokenAddress);

                        this.priceInfo = await this.sale.getPrice(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress);
                    });

                    testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress)();

                    testShouldRevertPurchaseTokenTransferFrom.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress,
                        tokenBalance)();

                    context('when sucessfully making a purchase', function () {
                        beforeEach(async function () {
                            await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                            await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                        });

                        afterEach(async function () {
                            await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                            const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                            await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                        });

                        context('when spending with more than the total price', function () {
                            beforeEach(async function () {
                                const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                                this.receipt = await this.sale.purchaseFor(
                                    recipient,
                                    lotId,
                                    quantity,
                                    tokenAddress,
                                    maxTokenAmount,
                                    this.priceInfo.minConversionRate,
                                    'extData',
                                    { from: operator });
                            });

                            testShouldCallPurchaseFor.bind(this)();

                            testShouldUpdateAvailableLotItems.bind(
                                this,
                                lotId,
                                quantity)();
                        });

                        context('when spending the exact total price amount', function () {
                            beforeEach(async function () {
                                this.receipt = await this.sale.purchaseFor(
                                    recipient,
                                    lotId,
                                    quantity,
                                    tokenAddress,
                                    this.priceInfo.totalPrice,
                                    this.priceInfo.minConversionRate,
                                    'extData',
                                    { from: operator });
                            });

                            testShouldCallPurchaseFor.bind(this)();

                            testShouldUpdateAvailableLotItems.bind(
                                this,
                                lotId,
                                quantity)();
                        });
                    });
                });
            });
        });
    });

    describe('getPrice()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        function testShouldReturnCorrectPurchasePricingInfo(recipient, tokenAddress, maxDeviationPercentSignificand = null, maxDeviationPercentOrderOfMagnitude = 0) {
            beforeEach(async function () {
                this.priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            });

            it('should return correct total price pricing info', async function () {
                const expectedTotalPrice = this.lot.price.mul(quantity);
                const actualTotalPrice = this.priceInfo.minConversionRate.mul(this.priceInfo.totalPrice).div(new BN(10).pow(new BN(18)));

                if (maxDeviationPercentSignificand) {
                    shouldBeEqualWithinDeviationPercent(
                        expectedTotalPrice,
                        actualTotalPrice,
                        maxDeviationPercentSignificand,
                        maxDeviationPercentOrderOfMagnitude);
                } else {
                    expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
                }
            });

            it('should return correct total discounts pricing info', async function () {
                const expectedTotalDiscounts = Constants.Zero;
                const actualTotalDiscounts = this.priceInfo.minConversionRate.mul(this.priceInfo.totalDiscounts).div(new BN(10).pow(new BN(18)));

                if (maxDeviationPercentSignificand) {
                    shouldBeEqualWithinDeviationPercent(
                        expectedTotalDiscounts,
                        actualTotalDiscounts,
                        maxDeviationPercentSignificand,
                        maxDeviationPercentOrderOfMagnitude);
                } else {
                    expectedTotalDiscounts.should.be.bignumber.equal(actualTotalDiscounts);
                }
            });
        }

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);
        });

        it('should revert if the lot doesnt exist', async function () {
            await expectRevert.unspecified(
                this.sale.getPrice(
                    recipient,
                    unknownLotId,
                    quantity,
                    tokenAddress));
        });

        it('should revert if the token address is the zero-address', async function () {
            await expectRevert.unspecified(
                this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    Constants.ZeroAddress));
        });

        context('when the purchase token currency is ETH', function () {
            testShouldReturnCorrectPurchasePricingInfo.bind(
                this,
                recipient,
                tokenAddress,
                Constants.One,
                -7)();  // max % dev: 0.0000001%
        });

        context('when the purchase token currency is an ERC20 token', function () {
            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                testShouldReturnCorrectPurchasePricingInfo.bind(
                    this,
                    recipient,
                    tokenAddress)();
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                testShouldReturnCorrectPurchasePricingInfo.bind(
                    this,
                    recipient,
                    tokenAddress)();
            });
        });
    });

    describe('_purchaseFor()', function () {
        const quantity = Constants.One;

        async function shouldRevert(recipient, lotId, quantity, tokenAddress, priceInfo, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            }

            await expectRevert.unspecified(
                this.sale.callUnderscorePurchaseFor(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    priceInfo.totalPrice,
                    priceInfo.minConversionRate,
                    'extData',
                    txParams));
        }

        function testShouldCallPurchaseForLifecycleFunctions() {
            it('should successfully call _purchaseForPricing()', async function () {
                expectEvent(
                    this.receipt,
                    'UnderscorePurchaseForPricingCalled');
            });

            it('should successfully call _purchaseForPayment()', async function () {
                expectEvent(
                    this.receipt,
                    'UnderscorePurchaseForPaymentCalled');
            });

            it('should successfully call _purchaseForDelivery()', async function () {
                expectEvent(
                    this.receipt,
                    'UnderscorePurchaseForDeliveryCalled');
            });

            it('should successfully call _purchaseForNotify()', async function () {
                expectEvent(
                    this.receipt,
                    'UnderscorePurchaseForNotifyCalled');
            });
        }

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;

            beforeEach(async function () {
                this.priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            });

            it('should revert if the transaction contains an insufficient amount of ETH', async function () {
                await shouldRevert.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    this.priceInfo,
                    {
                        from: operator,
                        value: this.priceInfo.totalPrice.divn(2)
                    })();
            });

            it('should revert if purchasing for less than the total price', async function () {
                this.priceInfo.totalPrice = this.priceInfo.totalPrice.divn(2);

                await shouldRevert.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    this.priceInfo,
                    {
                        from: operator,
                        value: this.priceInfo.totalPrice
                    })();
            });

            context('when sucessfully making a purchase', function () {
                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                        this.receipt = await this.sale.callUnderscorePurchaseFor(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            {
                                from: operator,
                                value: maxTokenAmount
                            });
                    });

                    testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        this.receipt = await this.sale.callUnderscorePurchaseFor(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            {
                                from: operator,
                                value: this.priceInfo.totalPrice
                            });
                    });

                    testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                });
            });
        });

        context('when the purchase token currency is an ERC20 token', function () {
            const tokenBalance = ether(Constants.One);

            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);

                    this.priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);
                });

                it('should revert if the transaction contains any ETH', async function () {
                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        {
                            from: operator,
                            value: Constants.One
                        })();
                });

                it('should revert if purchasing for less than the total price', async function () {
                    this.priceInfo.totalPrice = this.priceInfo.totalPrice.divn(2);

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();
                });

                it('should revert if the operator has an insufficient purchase balance', async function () {
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();

                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                });

                it('should revert if the sale contract has an insufficient purchase allowance from the operator', async function () {
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();

                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice.muln(2),
                                this.priceInfo.minConversionRate,
                                'extData',
                                { from: operator });
                        });

                        testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice,
                                this.priceInfo.minConversionRate,
                                'extData',
                                { from: operator });
                        });

                        testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                    });
                });
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);

                    this.priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);
                });

                it('should revert if purchasing for less than the total price', async function () {
                    this.priceInfo.totalPrice = this.priceInfo.totalPrice.divn(2);

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();
                });

                it('should revert if the operator has an insufficient purchase balance', async function () {
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();

                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                });

                it('should revert it the sale contract has an insufficient purchase allowance from the operator', async function () {
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                    await shouldRevert.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo,
                        { from: operator })();

                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice.muln(2),
                                this.priceInfo.minConversionRate,
                                'extData',
                                { from: operator });
                        });

                        testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseFor(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice,
                                this.priceInfo.minConversionRate,
                                'extData',
                                { from: operator });
                        });

                        testShouldCallPurchaseForLifecycleFunctions.bind(this)();
                    });
                });
            });
        });
    });

    describe('_purchaseForPricing()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);

            const priceInfo = await this.sale.getPrice(
                recipient,
                lotId,
                quantity,
                tokenAddress);

            const pricingInfoReceipt = await this.sale.callUnderscorePurchaseForPricing(
                recipient,
                lotId,
                quantity,
                tokenAddress,
                priceInfo.totalPrice,
                priceInfo.minConversionRate,
                'extData',
                { from: operator });

            const pricinginfoEvents = await this.sale.getPastEvents(
                'UnderscorePurchaseForPricingResult',
                {
                    fromBlock: 0,
                    toBlock: 'latest'
                });

            this.pricingInfo = pricinginfoEvents[0].args;
        });

        it('should return correct total price pricing info', async function () {
            const expectedTotalPrice = this.lot.price.mul(quantity);
            const actualTotalPrice = this.pricingInfo.totalPrice;
            expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
        });

        it('should return correct total discounts pricing info', async function () {
            const expectedTotalDiscounts = Constants.Zero;
            const actualTotalDiscounts = this.pricingInfo.totalDiscounts;
            expectedTotalDiscounts.should.be.bignumber.equal(actualTotalDiscounts);
        });
    });

    describe('_purchaseForPayment()', function () {
        const quantity = Constants.One;

        async function shouldRevert(recipient, lotId, quantity, tokenAddress, priceInfo, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            }

            const payoutPriceInfo = await this.sale.callUnderscoreGetPrice(
                recipient,
                lotId,
                quantity);

            await expectRevert.unspecified(
                this.sale.callUnderscorePurchaseForPayment(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    priceInfo.totalPrice,
                    priceInfo.minConversionRate,
                    '',
                    payoutPriceInfo.totalPrice,
                    payoutPriceInfo.totalDiscounts,
                    txParams));
        }

        async function shouldRevertWithValidatedQuantity(recipient, lotId, quantity, tokenAddress, priceInfo, txParams = {}) {
            const lot = await this.sale._lots(lotId);

            if (lot.exists) {
                (quantity.gt(Constants.Zero) && quantity.lte(lot.numAvailable)).should.be.true;
            }

            await shouldRevert.bind(this, recipient, lotId, quantity, tokenAddress, priceInfo, txParams)();
        }

        function testShouldRevertIfPurchasingForLessThanTheTotalPrice(recipient, lotId, quantity, tokenAddress) {
            it('should revert if purchasing for less than the total price', async function () {
                const priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
                priceInfo.totalPrice = priceInfo.totalPrice.divn(2);

                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    priceInfo,
                    { from: operator })();
            });
        }

        function testShouldRevertPurchaseTokenTransferFrom(lotId, quantity, tokenAddress, tokenBalance) {
            context('when the sale contract has a sufficient purchase allowance from the operator', function () {
                beforeEach(async function () {
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                });

                afterEach(async function () {
                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                });

                it('should revert if the operator has an insufficient purchase balance', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        null,
                        { from: operator })();
                });
            });

            context('when the operator has a sufficient purchase balance', function () {
                beforeEach(async function () {
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                });

                afterEach(async function () {
                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                it('should revert if the sale contract has an insufficient purchase allowance from the operator', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        null,
                        { from: operator })();
                });
            });
        }

        function testShouldTransferPayoutTokens(quantity) {
            it('should transfer payout tokens from the sale contract to the payout wallet', async function () {
                const totalPrice = this.lot.price.mul(quantity);

                await expectEvent.inTransaction(
                    this.receipt.tx,
                    this.erc20Payout,
                    'Transfer',
                    {
                        _from: this.sale.address,
                        _to: payoutWallet,
                        _value: totalPrice
                    });

                const payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);
                payoutWalletTokenBalance.should.be.bignumber.equal(
                    this.payoutWalletTokenBalance.add(totalPrice));
            });
        }

        beforeEach(async function () {
            this.erc20Payout = await ERC20.at(PayoutTokenAddress);
        });

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;

            it('should revert if the transaction contains an insufficient amount of ETH', async function () {
                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress,
                    null,
                    {
                        from: operator,
                        value: Constants.Zero
                    })();
            });

            testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                this,
                recipient,
                lotId,
                quantity,
                tokenAddress)();

            context('when sucessfully making a purchase', function () {
                beforeEach(async function () {
                    this.buyerEthBalance = await balance.current(operator);

                    this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                    this.lot = await this.sale._lots(lotId);
                    (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                    this.priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);

                    this.payoutPriceInfo = await this.sale.callUnderscoreGetPrice(
                        recipient,
                        lotId,
                        quantity);
                });

                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        this.maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                        this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            {
                                from: operator,
                                value: this.maxTokenAmount
                            });
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.priceInfo.totalPrice);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        quantity)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            {
                                from: operator,
                                value: this.priceInfo.totalPrice
                            });
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.priceInfo.totalPrice);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        quantity)();
                });
            });
        });

        context('when the purchase token currency is an ERC20 token', function () {
            const tokenBalance = ether(Constants.One);

            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);
                });

                it('should revert if the transaction contains any ETH', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        null,
                        {
                            from: operator,
                            value: Constants.One
                        })();
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress)();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);

                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        this.lot = await this.sale._lots(lotId);
                        (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                        this.priceInfo = await this.sale.getPrice(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress);

                        this.payoutPriceInfo = await this.sale.callUnderscoreGetPrice(
                            recipient,
                            lotId,
                            quantity);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                            this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.maxTokenAmount,
                                this.priceInfo.minConversionRate,
                                'extData',
                                this.payoutPriceInfo.totalPrice,
                                this.payoutPriceInfo.totalDiscounts,
                                { from: operator });
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.sale.address,
                                    // // unable to get an exact value due to the
                                    // // dynamic nature of the conversion rate,
                                    // // but it should be almost the purchase
                                    // // amount with a deviation of up to 5% in
                                    // // general.
                                    // _value: this.maxTokenAmount
                                });

                            const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                            const buyerPurchaseTokenBalanceDelta = this.buyerPurchaseTokenBalance.sub(buyerPurchaseTokenBalance);

                            shouldBeEqualWithinDeviationPercent(
                                this.priceInfo.totalPrice,
                                buyerPurchaseTokenBalanceDelta,
                                Constants.Five,
                                0); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.maxTokenAmount));
                        });

                        it('should transfer purchase tokens change from the sale contract to the operator', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: this.sale.address,
                                    _to: operator,
                                    // // unable to get an exact value due to the
                                    // // dynamic nature of the conversion rate,
                                    // // but it should be almost the difference
                                    // // between the purchase amount and the
                                    // // total price with a deviation of up to 5%
                                    // // in general.
                                    // _value: this.maxTokenAmount.sub(this.priceInfo.totalPrice)
                                });
                        });

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice,
                                this.priceInfo.minConversionRate,
                                'extData',
                                this.payoutPriceInfo.totalPrice,
                                this.payoutPriceInfo.totalDiscounts,
                                { from: operator });
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.sale.address,
                                    _value: this.priceInfo.totalPrice
                                });

                            const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                            const buyerPurchaseTokenBalanceDelta = this.buyerPurchaseTokenBalance.sub(buyerPurchaseTokenBalance);

                            shouldBeEqualWithinDeviationPercent(
                                this.priceInfo.totalPrice,
                                buyerPurchaseTokenBalanceDelta,
                                Constants.Five,
                                0); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.priceInfo.totalPrice));
                        });

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();
                    });
                });
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                function testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken() {
                    it('should transfer purchase tokens from the operator to the sale contract', async function () {
                        await expectEvent.inTransaction(
                            this.receipt.tx,
                            this.erc20,
                            'Transfer',
                            {
                                _from: operator,
                                _to: this.sale.address,
                                _value: this.priceInfo.totalPrice
                            });

                        const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                        buyerPurchaseTokenBalance.should.be.bignumber.equal(
                            this.buyerPurchaseTokenBalance.sub(this.priceInfo.totalPrice));

                        const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                        spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                            this.spenderPurchaseTokenAllowance.sub(this.priceInfo.totalPrice));
                    });
                }

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress)();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);

                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        this.lot = await this.sale._lots(lotId);
                        (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                        this.priceInfo = await this.sale.getPrice(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress);

                        this.payoutPriceInfo = await this.sale.callUnderscoreGetPrice(
                            recipient,
                            lotId,
                            quantity);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                            this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.maxTokenAmount,
                                this.priceInfo.minConversionRate,
                                'extData',
                                this.payoutPriceInfo.totalPrice,
                                this.payoutPriceInfo.totalDiscounts,
                                { from: operator });
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscorePurchaseForPayment(
                                recipient,
                                lotId,
                                quantity,
                                tokenAddress,
                                this.priceInfo.totalPrice,
                                this.priceInfo.minConversionRate,
                                'extData',
                                this.payoutPriceInfo.totalPrice,
                                this.payoutPriceInfo.totalDiscounts,
                                { from: operator });
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();
                    });
                });
            });
        });
    });

    describe('_purchaseForNotify()', function () {
        const quantity = Constants.One;

        function testShouldEmitThePurchasedEventWhenNotUsingPayoutToken(lotId, quantity, tokenAddress) {
            it('should emit the Purchased event', async function () {
                const totalFungibleAmount = this.lot.fungibleAmount.mul(quantity);
                const totalPrice = this.lot.price.mul(quantity);

                const purchasedEvents = await this.sale.getPastEvents(
                    'Purchased',
                    {
                        fromBlock: 0,
                        toBlock: 'latest'
                    });

                const purchasedEvent = purchasedEvents[0].args;

                purchasedEvent.recipient.should.be.equal(recipient);
                purchasedEvent.operator.should.be.equal(operator);
                purchasedEvent.lotId.should.be.bignumber.equal(lotId);
                purchasedEvent.quantity.should.be.bignumber.equal(quantity);
                purchasedEvent.nonFungibleTokens.length.should.be.equal(
                    this.nonFungibleTokens.length);

                for (let index = 0; index < purchasedEvent.nonFungibleTokens.length; index++) {
                    purchasedEvent.nonFungibleTokens[index].should.be.bignumber.equal(
                        this.nonFungibleTokens[index]);
                }

                purchasedEvent.totalFungibleAmount.should.be.bignumber.equal(totalFungibleAmount);
                purchasedEvent.totalPrice.should.be.bignumber.equal(totalPrice);
                purchasedEvent.tokenAddress.should.be.equal(tokenAddress);

                shouldBeEqualWithinDeviationPercent(
                    this.priceInfo.totalPrice,
                    purchasedEvent.tokensSent,
                    Constants.Five);

                purchasedEvent.tokensReceived.should.be.bignumber.equal(totalPrice);
                purchasedEvent.extData.should.be.equal('extData');

                // expectEvent(
                //     this.receipt,
                //     'Purchased',
                //     {
                //         recipient: recipient,
                //         operator: operator,
                //         lotId: lotId,
                //         quantity: quantity,
                //         // // deep array equality test for event
                //         // // arguments is not yet supported at the
                //         // // time of the creation of this test:
                //         // // https://github.com/OpenZeppelin/openzeppelin-test-helpers/pull/112
                //         // nonFungibleTokens: this.nonFungibleTokens,
                //         totalFungibleAmount: totalFungibleAmount,
                //         totalPrice: totalPrice,
                //         tokenAddress: tokenAddress,
                //         // // unable to get an exact value due to the
                //         // // dynamic nature of the conversion rate,
                //         // // but it should be almost the total price
                //         // // with a deviation of up to 5% in general.
                //         // tokensSent: this.priceInfo.totalPrice,
                //         tokensReceived: totalPrice,
                //         extData: 'extData'
                //     });
            });
        }

        function testShouldEmitThePurchasedEventWhenUsingPayoutToken(lotId, quantity, tokenAddress) {
            it('should emit the Purchased event', async function () {
                const totalFungibleAmount = this.lot.fungibleAmount.mul(quantity);
                const totalPrice = this.lot.price.mul(quantity);

                const purchasedEvents = await this.sale.getPastEvents(
                    'Purchased',
                    {
                        fromBlock: 0,
                        toBlock: 'latest'
                    });

                const purchasedEvent = purchasedEvents[0].args;

                purchasedEvent.recipient.should.be.equal(recipient);
                purchasedEvent.operator.should.be.equal(operator);
                purchasedEvent.lotId.should.be.bignumber.equal(lotId);
                purchasedEvent.quantity.should.be.bignumber.equal(quantity);
                purchasedEvent.nonFungibleTokens.length.should.be.equal(
                    this.nonFungibleTokens.length);

                for (let index = 0; index < purchasedEvent.nonFungibleTokens.length; index++) {
                    purchasedEvent.nonFungibleTokens[index].should.be.bignumber.equal(
                        this.nonFungibleTokens[index]);
                }

                purchasedEvent.totalFungibleAmount.should.be.bignumber.equal(totalFungibleAmount);
                purchasedEvent.totalPrice.should.be.bignumber.equal(totalPrice);
                purchasedEvent.tokenAddress.should.be.equal(tokenAddress);
                purchasedEvent.tokensSent.should.be.bignumber.equal(totalPrice);
                purchasedEvent.tokensReceived.should.be.bignumber.equal(totalPrice);
                purchasedEvent.extData.should.be.equal('extData');

                // expectEvent(
                //     this.receipt,
                //     'Purchased',
                //     {
                //         recipient: recipient,
                //         operator: operator,
                //         lotId: lotId,
                //         quantity: quantity,
                //         // // deep array equality test for event arguments
                //         // // is not yet supported at the time of the
                //         // // creation of this test:
                //         // // https://github.com/OpenZeppelin/openzeppelin-test-helpers/pull/112
                //         // nonFungibleTokens: this.nonFungibleTokens,
                //         totalFungibleAmount: totalFungibleAmount,
                //         totalPrice: totalPrice,
                //         tokenAddress: tokenAddress,
                //         tokensSent: totalPrice,
                //         tokensReceived: totalPrice,
                //         extData: 'extData'
                //     });
            });
        }

        beforeEach(async function () {
            this.nonFungibleTokens = await this.sale.peekLotAvailableNonFungibleSupply(
                lotId,
                quantity);

            this.nftExists = {};

            for (let index = 0; index < quantity.toNumber(); index++) {
                const nonFungibleTokenId = this.nonFungibleTokens[index];
                this.nftExists[nonFungibleTokenId] = await this.inventory.exists(nonFungibleTokenId);
            }

            this.recipientNftCollectionBalance = await this.inventory.balanceOf(
                recipient,
                nftCollectionId);

            this.recipientNftBalance = await this.inventory.balanceOf(
                recipient);

            this.recipientFtCollectionBalance = await this.inventory.balanceOf(
                recipient,
                ftCollectionId);

            this.lot = await this.sale._lots(lotId);
            (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

            this.payoutPriceInfo = await this.sale.callUnderscoreGetPrice(
                recipient,
                lotId,
                quantity);
        });

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;

            beforeEach(async function () {
                this.priceInfo = await this.sale.getPrice(
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress);
            });

            context('when spending with more than the total price', function () {
                beforeEach(async function () {
                    const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                    const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        maxTokenAmount,
                        this.priceInfo.minConversionRate,
                        'extData',
                        this.payoutPriceInfo.totalPrice,
                        this.payoutPriceInfo.totalDiscounts,
                        {
                            from: operator,
                            value: maxTokenAmount
                        });

                    const paymentInfoEvents = await this.sale.getPastEvents(
                        'UnderscorePurchaseForPaymentResult',
                        {
                            fromBlock: 0,
                            toBlock: 'latest'
                        });

                    this.paymentInfo = paymentInfoEvents[0].args;

                    this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        maxTokenAmount,
                        this.priceInfo.minConversionRate,
                        'extData',
                        this.payoutPriceInfo.totalPrice,
                        this.payoutPriceInfo.totalDiscounts,
                        this.paymentInfo.purchaseTokensSent,
                        this.paymentInfo.payoutTokensReceived,
                        { from: operator });
                });

                testShouldEmitThePurchasedEventWhenNotUsingPayoutToken.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress)();
            });

            context('when spending the exact total price amount', function () {
                beforeEach(async function () {
                    const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo.totalPrice,
                        this.priceInfo.minConversionRate,
                        'extData',
                        this.payoutPriceInfo.totalPrice,
                        this.payoutPriceInfo.totalDiscounts,
                        {
                            from: operator,
                            value: this.priceInfo.totalPrice
                        });

                    const paymentInfoEvents = await this.sale.getPastEvents(
                        'UnderscorePurchaseForPaymentResult',
                        {
                            fromBlock: 0,
                            toBlock: 'latest'
                        });

                    this.paymentInfo = paymentInfoEvents[0].args;

                    this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress,
                        this.priceInfo.totalPrice,
                        this.priceInfo.minConversionRate,
                        'extData',
                        this.payoutPriceInfo.totalPrice,
                        this.payoutPriceInfo.totalDiscounts,
                        this.paymentInfo.purchaseTokensSent,
                        this.paymentInfo.payoutTokensReceived,
                        { from: operator });
                });

                testShouldEmitThePurchasedEventWhenNotUsingPayoutToken.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress)();
            });
        });

        context('when the purchase token currency is an ERC20 token', function () {
            const tokenBalance = ether(Constants.One);

            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                    this.priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);
                });

                afterEach(async function () {
                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                        const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            { from: operator });

                        const paymentInfoEvents = await this.sale.getPastEvents(
                            'UnderscorePurchaseForPaymentResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.paymentInfo = paymentInfoEvents[0].args;

                        this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            this.paymentInfo.purchaseTokensSent,
                            this.paymentInfo.payoutTokensReceived,
                            { from: operator });
                    });

                    testShouldEmitThePurchasedEventWhenNotUsingPayoutToken.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            { from: operator });

                        const paymentInfoEvents = await this.sale.getPastEvents(
                            'UnderscorePurchaseForPaymentResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.paymentInfo = paymentInfoEvents[0].args;

                        this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            this.paymentInfo.purchaseTokensSent,
                            this.paymentInfo.payoutTokensReceived,
                            { from: operator });
                    });

                    testShouldEmitThePurchasedEventWhenNotUsingPayoutToken.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress)();
                });
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                beforeEach(async function () {
                    this.erc20 = await ERC20.at(tokenAddress);
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                    this.priceInfo = await this.sale.getPrice(
                        recipient,
                        lotId,
                        quantity,
                        tokenAddress);
                });

                afterEach(async function () {
                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        const maxTokenAmount = this.priceInfo.totalPrice.muln(2);

                        const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            { from: operator });

                        const paymentInfoEvents = await this.sale.getPastEvents(
                            'UnderscorePurchaseForPaymentResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.paymentInfo = paymentInfoEvents[0].args;

                        this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            maxTokenAmount,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            this.paymentInfo.purchaseTokensSent,
                            this.paymentInfo.payoutTokensReceived,
                            { from: operator });
                    });

                    testShouldEmitThePurchasedEventWhenUsingPayoutToken.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        const paymentInfoReceipt = await this.sale.callUnderscorePurchaseForPayment(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            { from: operator });

                        const paymentInfoEvents = await this.sale.getPastEvents(
                            'UnderscorePurchaseForPaymentResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.paymentInfo = paymentInfoEvents[0].args;

                        this.receipt = await this.sale.callUnderscorePurchaseForNotify(
                            recipient,
                            lotId,
                            quantity,
                            tokenAddress,
                            this.priceInfo.totalPrice,
                            this.priceInfo.minConversionRate,
                            'extData',
                            this.payoutPriceInfo.totalPrice,
                            this.payoutPriceInfo.totalDiscounts,
                            this.paymentInfo.purchaseTokensSent,
                            this.paymentInfo.payoutTokensReceived,
                            { from: operator });
                    });

                    testShouldEmitThePurchasedEventWhenUsingPayoutToken.bind(
                        this,
                        lotId,
                        quantity,
                        tokenAddress)();
                });
            });
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
