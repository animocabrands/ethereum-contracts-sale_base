const { BN, ether, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32 } = require('../utils/bytes32');

const {
    purchasingScenario
} = require('../scenarios');

const Sale = artifacts.require('OracleSaleMock');
const ERC20 = artifacts.require('ERC20Mock');

const skusCapacity = One;
const tokensPerSkuCapacity = Four;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;

const referenceTokenPrice = new BN('1000');

contract('OracleSale', function (accounts) {

    const [
        owner,
        payoutWallet,
        purchaser,
        recipient
    ] = accounts;

    async function doDeploy(params = {}) {
        this.referenceToken = await ERC20.new(
            params.referenceTokenSupply || ether('1000'),
            { from: owner });

        this.erc20Token = await ERC20.new(
            params.erc20TokenSupply || ether('1000'),
            { from: owner });

        this.contract = await Sale.new(
            params.payoutWallet || payoutWallet,
            params.skusCapacity || skusCapacity,
            params.tokensPerSkuCapacity || tokensPerSkuCapacity,
            params.referenceToken || this.referenceToken.address,
            { from: params.owner || owner });
    }

    async function doCreateSku(params = {}) {
        return await this.contract.createSku(
            params.sku || sku,
            params.skuTotalSupply || skuTotalSupply,
            params.skuMaxQuantityPerPurchase || skuMaxQuantityPerPurchase,
            params.skuNotificationsReceiver || skuNotificationsReceiver,
            { from: params.owner || owner });
    }

    async function doUpdateSkuPricing(params = {}) {
        this.ethTokenAddress = await this.contract.TOKEN_ETH();
        this.oraclePrice = await this.contract.PRICE_CONVERT_VIA_ORACLE();

        const skuTokens = [
            this.referenceToken.address,
            this.ethTokenAddress,
            this.erc20Token.address];

        const tokenPrices = [
            referenceTokenPrice, // reference token
            this.oraclePrice, // ETH token
            this.oraclePrice]; // ERC20 token

        return await this.contract.updateSkuPricing(
            params.sku || sku,
            params.tokens || skuTokens,
            params.prices || tokenPrices,
            { from: params.owner || owner });
    }

    async function doSetConversionRates(params = {}) {
        const tokenRates = {};
        tokenRates[this.referenceToken.address] = params.referenceTokenRate != undefined ? params.referenceTokenRate : ether('1');
        tokenRates[this.ethTokenAddress] = params.ethTokenRate != undefined ? params.ethTokenRate : ether('2');
        tokenRates[this.erc20Token.address] = params.erc20Rate != undefined ? params.erc20Rate : ether('0.5');

        for (const [token, rate] of Object.entries(tokenRates)) {
            await this.contract.setMockConversionRate(
                token,
                this.referenceToken.address,
                rate);
        }
    }

    async function doStart(params = {}) {
        return await this.contract.start({ from: params.owner || owner });
    };

    describe('referenceToken()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it ('should return the reference token', async function () {
            const expected = this.referenceToken.address;
            const actual = await this.contract.referenceToken();
            actual.should.be.equal(expected);
        });

    });

    describe('conversionRates()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('should revert if the oracle does not provide a conversion rate for one of the pairs', async function () {
            await expectRevert(
                this.contract.conversionRates(
                    [ this.ethTokenAddress ]),
                'OracleSaleMock: undefined conversion rate');
        });

        it(`should return the correct conversion rates`, async function () {
            await doSetConversionRates.bind(this)();

            const tokens = [
                this.referenceToken.address,
                this.ethTokenAddress,
                this.erc20Token.address
            ];

            const actualRates = await this.contract.conversionRates(tokens);
            const expectedRates = [];

            for (const token of tokens) {
                const rate = await this.contract.mockConversionRates(
                    token,
                    this.referenceToken.address);
                expectedRates.push(rate);
            }

            for (var index = 0; index < tokens.length; ++index) {
                actualRates[index].should.be.bignumber.equal(expectedRates[index]);
            }
        });

    });

    describe('_setTokenPrices()', function () {

        beforeEach(async function() {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should revert if a SKU has token prices but does not include the reference token (adding)', async function () {
            await expectRevert(
                this.contract.setTokenPrices(
                    sku,
                    [ await this.contract.TOKEN_ETH() ],
                    [ One ]),
                'OracleSale: missing reference token');
        });

        it('should revert if a SKU has token prices but does not include the reference token (removing)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await expectRevert(
                this.contract.setTokenPrices(
                    sku,
                    [ this.referenceToken.address ],
                    [ Zero ]),
                'OracleSale: missing reference token');
        });

    });

    describe('_unitPrice()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should return the fixed unit price', async function () {
            const ethTokenUnitFixedPrice = ether('3');

            await doUpdateSkuPricing.bind(this)({
                prices: [
                    One, // reference token
                    ethTokenUnitFixedPrice, // ETH token
                    One] // ERC20 token
            });

            const unitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                this.ethTokenAddress,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            unitPrice.should.be.bignumber.equal(ethTokenUnitFixedPrice);
        });

        it('should return the oracle unit price (0 < rate < 1)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();

            const conversionRate = await this.contract.mockConversionRates(
                this.erc20Token.address,
                this.referenceToken.address);

            const actualUnitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                this.erc20Token.address,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const expectedUnitPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(conversionRate);

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });

        it('should return the oracle unit price (1 == rate)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();

            const conversionRate = await this.contract.mockConversionRates(
                this.referenceToken.address,
                this.referenceToken.address);

            const actualUnitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                this.referenceToken.address,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const expectedUnitPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(conversionRate);

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });

        it('should return the oracle unit price (1 < rate)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();

            const conversionRate = await this.contract.mockConversionRates(
                this.ethTokenAddress,
                this.referenceToken.address);

            const actualUnitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                this.ethTokenAddress,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const expectedUnitPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(conversionRate);

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });
    });

    describe('scenarios', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();
            await doStart.bind(this)();
        });

        describe('purchasing', function () {

            beforeEach(async function () {
                await this.erc20Token.transfer(purchaser, ether('1'));
                await this.erc20Token.transfer(recipient, ether('1'));

                this.erc20TokenAddress = this.erc20Token.address;
            });

            purchasingScenario([ purchaser, recipient ], sku);

        });

    });

});
