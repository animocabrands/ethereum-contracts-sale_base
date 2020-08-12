const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three } = require('@animoca/ethereum-contracts-core_library').constants;

const { uintToBytes32 } = require('../../utils/bytes32');

const SkuTokenPrice = artifacts.require('SkuTokenPriceMock');
const ERC20 = artifacts.require('ERC20Mock.sol');

contract('SkuTokenPrice', function ([
    _,
    owner,
    ...accounts
]) {
    async function setAllSkuTokenPrices() {
        await this.contract.addSkus(this.skus);
        await this.contract.addTokens(this.tokens);

        let priceIndex = 0;

        for (let skuIndex = 0; skuIndex < this.skus.length; ++skuIndex) {
            const sku = this.skus[skuIndex];
            const prices = [];

            for (let tokenIndex = 0; tokenIndex < this.tokens.length; ++tokenIndex) {
                prices[priceIndex] = this.prices[priceIndex];
                ++priceIndex;
            }

            await this.contract.setPrices(sku, this.tokens, prices);
        }
    }

    beforeEach(async function () {
        this.skus = [
            uintToBytes32(One),
            uintToBytes32(Two),
            uintToBytes32(Three)
        ];

        this.unknownSku = uintToBytes32(Zero);

        this.tokens = [
            (await ERC20.new(Zero, { from: owner })).address,
            (await ERC20.new(Zero, { from: owner })).address,
            (await ERC20.new(Zero, { from: owner })).address
        ];

        this.unknownToken = ZeroAddress;

        this.prices = [
            ether('1'),
            ether('10'),
            ether('100'),
            ether('10000'),
            ether('100000'),
            ether('1000000'),
            ether('10000000'),
            ether('100000000'),
            ether('1000000000')
        ];

        this.contract = await SkuTokenPrice.new({ from: owner });
    });

    describe('addSkus()', function () {
        it('should not add empty sku list', async function() {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            const receipt = await this.contract.addSkus([]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(0);
        });

        it('should add a single sku', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            const receipt = await this.contract.addSkus([this.skus[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(1);
            skus[0].should.be.equal(this.skus[0]);
        });

        it('should not add an existing sku', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            let receipt = await this.contract.addSkus([this.skus[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(1);
            skus[0].should.be.equal(this.skus[0]);

            receipt = await this.contract.addSkus([this.skus[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [false] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(1);
            skus[0].should.be.equal(this.skus[0]);
        });

        it('should add multiple skus', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            const receipt = await this.contract.addSkus(this.skus);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.skus.length).fill(true) });

            skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);

            skus.every((item, index) => item == this.skus[index]).should.be.true;
        });
    });

    describe('removeSkus()', function () {
        beforeEach(async function () {
            await setAllSkuTokenPrices.bind(this)();
        });

        it('should not remove empty sku list', async function() {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
            skus.every((item, index) => item == this.skus[index]).should.be.true;

            const receipt = await this.contract.removeSkus([]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
        });

        it('should remove a single sku', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
            skus.every((item, index) => item == this.skus[index]).should.be.true;

            const receipt = await this.contract.removeSkus([this.skus[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length - 1);

            for (let index = 0; index < this.tokens.length; ++index) {
                const token = this.tokens[index];

                await expectRevert(
                    this.contract.getPrice(
                        this.skus[0],
                        token),
                    'SkuTokenPrice: non-existent sku');
            }
        });

        it('should not remove a non-existent sku', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
            skus.every((item, index) => item == this.skus[index]).should.be.true;

            const receipt = await this.contract.removeSkus([this.unknownSku]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [false] });

            skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
        });

        it('should remove multiple skus', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);
            skus.every((item, index) => item == this.skus[index]).should.be.true;

            const receipt = await this.contract.removeSkus(this.skus);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.skus.length).fill(true) });

            skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            for (let skuIndex = 0; skuIndex < this.skus.length; ++skuIndex) {
                const sku = this.skus[skuIndex];

                for (let tokenIndex = 0; tokenIndex < this.tokens.length; ++tokenIndex) {
                    const token = this.tokens[tokenIndex];

                    await expectRevert(
                        this.contract.getPrice(
                            sku,
                            token),
                        'SkuTokenPrice: non-existent sku');
                }
            }
        });
    });

    describe('hasSku()', function () {
        it('should return true for an existing sku', async function () {
            await this.contract.addSkus(this.skus);
            const exists = await this.contract.hasSku(this.skus[0]);
            exists.should.be.true;
        });

        it('should return false for a non-existent sku (empty sku list)', async function () {
            const exists = await this.contract.hasSku(this.unknownSku);
            exists.should.be.false;
        });

        it('should return false for a non-existent sku (non-empty sku list)', async function () {
            await this.contract.addSkus(this.skus);
            const exists = await this.contract.hasSku(this.unknownSku);
            exists.should.be.false;
        });
    });

    describe('getSkus()', function () {
        it('should return an empty list', async function () {
            const skus = await this.contract.getSkus();
            skus.length.should.equal(0);
        });

        it('should return all supported skus', async function () {
            let skus = await this.contract.getSkus();
            skus.length.should.equal(0);

            const receipt = await this.contract.addSkus(this.skus);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.skus.length).fill(true) });

            skus = await this.contract.getSkus();
            skus.length.should.equal(this.skus.length);

            skus.every((item, index) => item == this.skus[index]).should.be.true;
        });
    });

    describe('addTokens()', function () {
        it('should not add empty token list', async function() {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            const receipt = await this.contract.addTokens([]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);
        });

        it('should add a single token', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            const receipt = await this.contract.addTokens([this.tokens[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(1);
            tokens[0].should.be.equal(this.tokens[0]);
        });

        it('should not add an existing token', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            let receipt = await this.contract.addTokens([this.tokens[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(1);
            tokens[0].should.be.equal(this.tokens[0]);

            receipt = await this.contract.addTokens([this.tokens[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [false] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(1);
            tokens[0].should.be.equal(this.tokens[0]);
        });

        it('should add multiple tokens', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            const receipt = await this.contract.addTokens(this.tokens);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.tokens.length).fill(true) });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);

            tokens.every((item, index) => item == this.tokens[index]).should.be.true;
        });
    });

    describe('removeTokens()', function () {
        beforeEach(async function () {
            await setAllSkuTokenPrices.bind(this)();
        });

        it('should not remove empty token list', async function() {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
            tokens.every((item, index) => item == this.tokens[index]).should.be.true;

            const receipt = await this.contract.removeTokens([]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
        });

        it('should remove a single token', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
            tokens.every((item, index) => item == this.tokens[index]).should.be.true;

            const receipt = await this.contract.removeTokens([this.tokens[0]]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [true] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length - 1);

            for (let index = 0; index < this.skus.length; ++index) {
                const sku = this.skus[index];

                await expectRevert(
                    this.contract.getPrice(
                        sku,
                        this.tokens[0]),
                    'SkuTokenPrice: unsupported token');
            }
        });

        it('should not remove a non-existent token', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
            tokens.every((item, index) => item == this.tokens[index]).should.be.true;

            const receipt = await this.contract.removeTokens([this.unknownToken]);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: [false] });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
        });

        it('should remove multiple tokens', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);
            tokens.every((item, index) => item == this.tokens[index]).should.be.true;

            const receipt = await this.contract.removeTokens(this.tokens);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.tokens.length).fill(true) });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            for (let skuIndex = 0; skuIndex < this.skus.length; ++skuIndex) {
                const sku = this.skus[skuIndex];

                for (let tokenIndex = 0; tokenIndex < this.tokens.length; ++tokenIndex) {
                    const token = this.tokens[tokenIndex];

                    await expectRevert(
                        this.contract.getPrice(
                            sku,
                            token),
                        'SkuTokenPrice: unsupported token');
                }
            }
        });
    });

    describe('hasToken()', function () {
        it('should return true for an existing token', async function () {
            await this.contract.addTokens(this.tokens);
            const exists = await this.contract.hasToken(this.tokens[0]);
            exists.should.be.true;
        });

        it('should return false for a non-existent token (empty token list)', async function () {
            const exists = await this.contract.hasToken(this.unknownToken);
            exists.should.be.false;
        });

        it('should return false for a non-existent token (non-empty token list)', async function () {
            await this.contract.addTokens(this.tokens);
            const exists = await this.contract.hasToken(this.unknownToken);
            exists.should.be.false;
        });
    });

    describe('getTokens()', function () {
        it('should return an empty list', async function () {
            const tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);
        });

        it('should return all supported tokens', async function () {
            let tokens = await this.contract.getTokens();
            tokens.length.should.equal(0);

            const receipt = await this.contract.addTokens(this.tokens);

            expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'AddRemoveResult',
                { result: Array(this.tokens.length).fill(true) });

            tokens = await this.contract.getTokens();
            tokens.length.should.equal(this.tokens.length);

            tokens.every((item, index) => item == this.tokens[index]).should.be.true;
        });
    });

    describe('getPrice()', function () {
        beforeEach(async function () {
            await setAllSkuTokenPrices.bind(this)();
        });

        it('should revert when retrieving the price with a non-existent sku', async function () {
            await expectRevert(
                this.contract.getPrice(
                    this.unknownSku,
                    this.tokens[0]),
                'SkuTokenPrice: non-existent sku');
        });

        it('should revert when retrieving the price with an unsupported token', async function () {
            await expectRevert(
                this.contract.getPrice(
                    this.skus[0],
                    this.unknownToken),
                'SkuTokenPrice: unsupported token');
        });

        it('should correctly retrieve the price', async function () {
            let priceIndex = 0;

            for (let skuIndex = 0; skuIndex < this.skus.length; ++skuIndex) {
                const sku = this.skus[skuIndex];

                for (let tokenIndex = 0; tokenIndex < this.tokens.length; ++tokenIndex) {
                    const token = this.tokens[tokenIndex];

                    const price = await this.contract.getPrice(sku, token);

                    price.should.be.bignumber.equal(this.prices[priceIndex++]);
                }
            }
        });
    });

    describe('setPrices()', function () {
        beforeEach(async function () {
            await this.contract.addSkus([this.skus[0]]);
            await this.contract.addTokens([this.tokens[0], this.tokens[1]]);
        });

        it('should revert if setting the price with a non-existent sku', async function () {
            let exists = await this.contract.hasSku(this.unknownSku);
            exists.should.be.false;

            exists = await this.contract.hasToken(this.tokens[0]);
            exists.should.be.true;

            await expectRevert(
                this.contract.setPrices(
                    this.unknownSku,
                    [this.tokens[0]],
                    [this.prices[0]]),
                'SkuTokenPrice: non-existent sku');
        });

        it('should revert if setting the price with an unsupported token', async function () {
            let exists = await this.contract.hasSku(this.skus[0]);
            exists.should.be.true;

            exists = await this.contract.hasToken(this.unknownToken);
            exists.should.be.false;

            await expectRevert(
                this.contract.setPrices(
                    this.skus[0],
                    [this.unknownToken],
                    [this.prices[0]]),
                'SkuTokenPrice: unsupported token');
        });

        it('should revert if the token/price lists are not aligned', async function () {
            await expectRevert(
                this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[0], this.prices[1]]),
                'SkuTokenPrice: token/price list mis-match');
        });

        context('when setting an empty sku token price', function () {
            it('should set the correct token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[0]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);

                await this.contract.setPrices(
                    this.skus[0],
                    [],
                    []);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);
            });

            it('should return the correct previous token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[0]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);

                const receipt = await this.contract.setPrices(
                    this.skus[0],
                    [],
                    []);

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SetPricesResult',
                    { prevPrices: [] });
            });
        });

        context('when setting a single sku token price', function () {
            it('should set the correct token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[0]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);

                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[1]]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[1]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);
            });

            it('should return the correct previous token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[0]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(Zero);

                const receipt = await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0]],
                    [this.prices[1]]);

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SetPricesResult',
                    { prevPrices: [this.prices[0].toString()] });
            });
        });

        context('when setting multiple sku token prices', function () {
            it('should set the correct token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0], this.tokens[1]],
                    [this.prices[0], this.prices[1]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(this.prices[1]);

                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0], this.tokens[1]],
                    [this.prices[2], this.prices[3]]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[2]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(this.prices[3]);
            });

            it('should return the correct previous token prices', async function () {
                await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0], this.tokens[1]],
                    [this.prices[0], this.prices[1]]);

                let price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[0]);

                price.should.be.bignumber.equal(this.prices[0]);

                price = await this.contract.getPrice(
                    this.skus[0],
                    this.tokens[1]);

                price.should.be.bignumber.equal(this.prices[1]);

                const receipt = await this.contract.setPrices(
                    this.skus[0],
                    [this.tokens[0], this.tokens[1]],
                    [this.prices[2], this.prices[3]]);

                expectEvent.inTransaction(
                    receipt.tx,
                    this.contract,
                    'SetPricesResult',
                    {
                        prevPrices: [
                            this.prices[0].toString(),
                            this.prices[1].toString()
                        ]
                    });
            });
        });
    });
});
