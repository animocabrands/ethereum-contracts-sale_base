const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32, bytes32ToUint } = require('../utils/bytes32');

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
const userData = '0x00';

const referenceTokenPrice = new BN('1000');

contract('OracleConvertSale', function (accounts) {

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

    describe('_pricing()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();
        });

        it('should call _oraclePricing() if the sku token price is the PRICE_CONVERT_VIA_ORACLE magic value', async function() {
            const receipt = await this.contract.callUnderscoreOraclePricing(
                recipient,
                this.ethTokenAddress,
                sku,
                One,
                userData,
                { from: purchaser });

            await expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'UnderscoreOraclePricingResult',
                { handled: true });
        });

        it('should not call _oraclePricing() if the sku token price is not the PRICE_CONVERT_VIA_ORACLE magic value', async function () {
            const receipt = await this.contract.callUnderscoreOraclePricing(
                recipient,
                this.referenceToken.address,
                sku,
                One,
                userData,
                { from: purchaser });

            await expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'UnderscoreOraclePricingResult',
                { handled: false });
        });

    });

    describe('conversionRates()', function () {

        const userData = stringToBytes32('userData');

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('should revert if the oracle does not provide a conversion rate for one of the pairs', async function () {
            await expectRevert(
                this.contract.conversionRates(
                    [ this.ethTokenAddress ],
                    userData),
                'OracleConvertSaleMock: undefined conversion rate');
        });

        it(`should return the correct conversion rates`, async function () {
            await doSetConversionRates.bind(this)();

            const tokens = [
                this.referenceToken.address,
                this.ethTokenAddress,
                this.erc20Token.address
            ];

            const actualRates = await this.contract.conversionRates(tokens, userData);
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

    describe('_oraclePricing()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doSetConversionRates.bind(this)();
        });

        it('should not handle oracle pricing', async function () {
            const receipt = await this.contract.callUnderscoreOraclePricing(
                recipient,
                this.referenceToken.address,
                sku,
                One,
                userData);

            await expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'UnderscoreOraclePricingResult',
                { handled: false });
        });

        it('should calculate the correct oracle-based purchase price', async function () {
            const quantity = One;

            const receipt = await this.contract.callUnderscoreOraclePricing(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData);

            const conversionRate = await this.contract.mockConversionRates(
                this.ethTokenAddress,
                this.referenceToken.address);
            const totalPrice = referenceTokenPrice
                .mul(new BN(10).pow(new BN(18)))
                .div(conversionRate)
                .mul(quantity);

            await expectEvent.inTransaction(
                receipt.tx,
                this.contract,
                'UnderscoreOraclePricingResult',
                {
                    handled: true,
                    pricingData: [
                        web3.utils.padLeft(web3.utils.toHex(this.oraclePrice), 64),
                        web3.utils.padLeft(web3.utils.toHex(conversionRate), 64)
                    ],
                    totalPrice: totalPrice
                });
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
