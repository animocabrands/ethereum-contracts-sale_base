const { BN, ether, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32 } = require('../utils/bytes32');

const {
    purchasingScenario
} = require('../scenarios');

const Sale = artifacts.require('OracleConvertSaleMock');
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
        this.oraclePrice = await this.contract.PRICE_VIA_ORACLE();

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

    describe('_setTokenPrices()', function () {

        beforeEach(async function() {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should revert if a SKU has token prices but does not include the reference token (adding)', async function () {
            await expectRevert(
                this.contract.callUnderscoreSetTokenPrices(
                    sku,
                    [ await this.contract.TOKEN_ETH() ],
                    [ One ]),
                'OracleSale: missing reference token');
        });

        it('should revert if a SKU has token prices but does not include the reference token (removing)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await expectRevert(
                this.contract.callUnderscoreSetTokenPrices(
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

            const unitPrice = await this.contract.callUnderscoreUnitPrice(
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

        it('should return the oracle unit price magic value', async function () {
            await doUpdateSkuPricing.bind(this)();
            const conversionRate = new BN(10).pow(new BN(18));

            const actualUnitPrice = await this.contract.callUnderscoreUnitPrice(
                ZeroAddress,
                this.erc20Token.address,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const expectedUnitPrice = await this.contract.PRICE_VIA_ORACLE();

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });

        it('should return the reference token unit price', async function () {
            await doUpdateSkuPricing.bind(this)();

            const actualUnitPrice = await this.contract.callUnderscoreUnitPrice(
                ZeroAddress,
                this.referenceToken.address,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            actualUnitPrice.should.be.bignumber.equal(referenceTokenPrice);
        });

    });

    describe('scenarios', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
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
