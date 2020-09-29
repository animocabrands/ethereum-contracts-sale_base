const { BN, ether, balance, time, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { shouldBeEqualWithPercentPrecision } = require('@animoca/ethereum-contracts-core_library/test/fixtures');
const { stringToBytes32 } = require('../utils/bytes32');
const { fromWei } = require('web3-utils');
const Fixture = require('../utils/fixture');
const Path = require('path');
const Resolver = require('@truffle/resolver');
const UniswapV2Fixture = require('../fixtures/uniswapv2.fixture');

const resolver = new Resolver({
    working_directory: __dirname,
    contracts_build_directory: Path.join(__dirname, '../../build'),
    provider: web3.eth.currentProvider,
    gas: 9999999
});

const ERC20 = resolver.require('ERC20', UniswapV2Fixture.UniswapV2PeripheryBuildPath);
const WETH9 = resolver.require('WETH9', UniswapV2Fixture.UniswapV2PeripheryBuildPath);
const UniswapV2Router = resolver.require('UniswapV2Router02', UniswapV2Fixture.UniswapV2PeripheryBuildPath);

const Sale = artifacts.require('OracleSaleMock');

const skusCapacity = One;
const tokensPerSkuCapacity = Four;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;

contract('OracleSale', function (accounts) {
    const loadFixture = Fixture.createFixtureLoader(accounts, web3.eth.currentProvider);

    // uniswapv2 fixture adds `contract` field to each token when it's loaded
    const tokens = {
        'WETH': {
            abstraction: WETH9,
            supply: ether('1000')},
        'ReferenceToken': {
            abstraction: ERC20,
            supply: ether('1000')},
        'TokenA': {
            abstraction: ERC20,
            supply: ether('1000')},
        'TokenB': {
            abstraction: ERC20,
            supply: ether('1000')},
        'TokenC': {
            abstraction: ERC20,
            supply: ether('1000')},
    };

    const tokenPairs = {
        'Pair1': ['WETH', 'ReferenceToken'],
        'Pair2': ['TokenA', 'ReferenceToken'],
        'Pair3': ['TokenB', 'ReferenceToken']
    };

    const liquidity = {
        'ReferenceToken': {
            amount: new BN('1000000'),
            price: new BN('1000')},
        'TokenA': {
            amount: new BN('2000'),
            price: new BN('2')},
        'TokenB': {
            amount: new BN('3000000000'),
            price: new BN('3000000')}
    };

    const [
        owner,
        payoutWallet
    ] = accounts;

    async function doLoadFixture(params = {}) {
        const fixture = UniswapV2Fixture.get(
            params.tokens || tokens,
            params.tokenPairs || tokenPairs);

        this.fixtureData = await loadFixture(fixture);
    }

    async function doAddLiquidity(params = {}) {
        const timestamp = await time.latest();
        const deadline = params.deadline || timestamp.add(time.duration.minutes(5));

        const amountRefTokenMin = params.amountRefTokenMin || Zero;
        const amountTokenMin = params.amountTokenMin || Zero;
        const amountEthMin = params.amountEthMin || Zero;
        const router = this.fixtureData.router;

        const refTokenKey = 'ReferenceToken';
        const refTokenContract = tokens[refTokenKey].contract;
        const refLiquidityData = liquidity[refTokenKey];

        for (const [tokenPairKey, tokenPair] of Object.entries(tokenPairs)) {
            if (tokenPair.length !== 2) {
                throw new Error(`Invalid token pair length: ${tokenPairKey}`);
            }

            const refTokenIndex = tokenPair.indexOf(refTokenKey);

            if (refTokenIndex === -1) {
                throw new Error(`Missing expected reference token in pair: ${tokenPairKey}`);
            }

            const tokenIndex = refTokenIndex === 0 ? 1 : 0;
            const tokenKey = tokenPair[tokenIndex];

            await refTokenContract.approve(
                router.address,
                refLiquidityData.amount,
                { from: refLiquidityData.owner || owner });

            if (tokenKey === 'WETH') {
                await router.addLiquidityETH(
                    refTokenContract.address,
                    refLiquidityData.amount,
                    amountRefTokenMin,
                    amountEthMin,
                    refLiquidityData.lpTokenRecipient || owner,
                    deadline,
                    {
                        from: refLiquidityData.owner || owner,
                        value: refLiquidityData.amount.mul(refLiquidityData.price)
                    });
            } else {
                const tokenContract = tokens[tokenKey].contract;
                const liquidityData = liquidity[tokenKey];

                await tokenContract.approve(
                    router.address,
                    liquidityData.amount,
                    { from: liquidityData.owner || owner });

                await router.addLiquidity(
                    tokenContract.address,
                    refTokenContract.address,
                    liquidityData.amount,
                    refLiquidityData.amount,
                    amountTokenMin,
                    amountRefTokenMin,
                    liquidityData.lpTokenRecipient || owner,
                    deadline,
                    {
                        from: liquidityData.owner || owner
                    });

                await tokenContract.approve(
                    router.address,
                    Zero,
                    { from: liquidityData.owner || owner });
            }

            await refTokenContract.approve(
                router.address,
                Zero,
                { from: refLiquidityData.owner || owner });
        }
    }

    async function doDeploy(params = {}) {
        this.contract = await Sale.new(
            params.payoutWallet || payoutWallet,
            params.skusCapacity || skusCapacity,
            params.tokensPerSkuCapacity || tokensPerSkuCapacity,
            params.referenceToken || tokens['ReferenceToken'].contract.address,
            params.router || this.fixtureData.router.address,
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
            tokens['ReferenceToken'].contract.address,
            this.ethTokenAddress,
            tokens['TokenA'].contract.address,
            tokens['TokenB'].contract.address];

        const tokenPrices = [
            liquidity['ReferenceToken'].price, // reference token
            this.oraclePrice, // ETH
            this.oraclePrice, // Token A
            this.oraclePrice]; // Token B

        return await this.contract.updateSkuPricing(
            params.sku || sku,
            params.tokens || skuTokens,
            params.prices || tokenPrices,
            { from: params.owner || owner });
    }

    async function doStart(params = {}) {
        return await this.contract.start({ from: params.owner || owner });
    };

    beforeEach(async function () {
        await doLoadFixture.bind(this)();
    });

    describe('referenceToken()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it ('should return the reference token', async function () {
            const expected = tokens['ReferenceToken'].contract.address;
            const actual = await this.contract.referenceToken();
            actual.should.be.equal(expected);
        });

    });

    describe('conversionRates()', function () {

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();

            const tokenKeysMap = {};

            for (const tokenPair of Object.values(tokenPairs)) {
                const refTokenIndex = tokenPair[0] === 'ReferenceToken' ? 0 : 1;
                const tokenIndex = refTokenIndex == 0 ? 1 : 0;
                const tokenKey = tokenPair[tokenIndex];
                tokenKeysMap[tokenKey] = true;
            }

            this.tokenKeys = Object.keys(tokenKeysMap);
            this.tokensToConvert = this.tokenKeys.map(item => tokens[item].contract.address);
        });

        it('should revert if one of the tokens to convert is the zero address', async function () {
            await expectRevert(
                this.contract.conversionRates(
                    [ ...this.tokensToConvert, ZeroAddress ],
                    One),
                'UniswapV2Library: ZERO_ADDRESS');
        });

        it('should revert if one of the tokens to convert is the reference token', async function () {
            await expectRevert(
                this.contract.conversionRates(
                    [ ...this.tokensToConvert, tokens['ReferenceToken'].contract.address ],
                    One),
                'UniswapV2Library: IDENTICAL_ADDRESSES');
        });

        it('should revert if one of the tokens to convert is not paired with the reference token', async function () {
            await expectRevert(
                this.contract.conversionRates(
                    [ ...this.tokensToConvert, tokens['TokenC'].contract.address ],
                    One),
                'revert');
        });

        it(`should return the correct conversion rates`, async function () {
            const tokenReserves = [];
            const refTokenAddress = tokens['ReferenceToken'].contract.address;
            var refReserve = 0;

            for (const tokenAddress of this.tokensToConvert) {
                const reserves = await this.contract.getReserves(
                    tokenAddress,
                    refTokenAddress);
                tokenReserves.push(reserves.reserveA);
                refReserve = reserves.reserveB;
            }

            // to make testing easier, we use a reference token reserve amount
            // that will result in the rates based off of the tokens-to-convert
            // reserve amounts
            const refAmount = refReserve.divn(2);
            const rates = await this.contract.conversionRates(this.tokensToConvert, refAmount);

            const refLiquidityData = liquidity['ReferenceToken'];

            for (var index = 0; index < this.tokenKeys.length; ++index) {
                const tokenKey = this.tokenKeys[index];
                const rate = rates[index];

                // based on the UniswapV2Library::getAmountIn() calculation
                // https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol#L53
                var expectedAmount = tokenReserves[index]
                    .muln(1000).divn(997).addn(1)
                    .mul(rate)
                    .div(new BN(10).pow(new BN(18)));

                const actualAmount = refAmount;

                shouldBeEqualWithPercentPrecision(actualAmount, expectedAmount, 1, -3);
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
                    [ tokens['TokenA'].contract.address ],
                    [ One ]),
                'OracleSale: missing reference token');
        });

        it('should revert if a SKU has token prices but does not include the reference token (removing)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await expectRevert(
                this.contract.setTokenPrices(
                    sku,
                    [ tokens['ReferenceToken'].contract.address ],
                    [ Zero ]),
                'OracleSale: missing reference token');
        });

    });

    describe('_unitPrice()', function () {

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should return the fixed unit price', async function () {
            const tokenA = tokens['TokenA'].contract.address;
            const tokenAUnitFixedPrice = ether('3');

            await doUpdateSkuPricing.bind(this)({
                prices: [
                    One, // reference token
                    One, // ETH
                    tokenAUnitFixedPrice, // Token A
                    One] // Token B
            });

            const unitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                tokenA,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            unitPrice.should.be.bignumber.equal(tokenAUnitFixedPrice);
        });

        it('should return the oracle unit price (0 < rate < 1)', async function () {
            await doUpdateSkuPricing.bind(this)();
            const tokenA = tokens['TokenA'].contract.address;

            const actualUnitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                tokenA,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const refLiquidityData = liquidity['ReferenceToken'];
            const rates = await this.contract.conversionRates([ tokenA ], refLiquidityData.price);
            const expectedUnitPrice = refLiquidityData.price.mul(new BN(10).pow(new BN(18))).div(rates[0]);

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });

        it('should return the oracle unit price (1 <= rate)', async function () {
            await doUpdateSkuPricing.bind(this)();
            const tokenB = tokens['TokenB'].contract.address;

            const actualUnitPrice = await this.contract.getUnitPrice(
                ZeroAddress,
                tokenB,
                sku,
                One,
                '0x00',
                Zero,
                [],
                [],
                []);

            const refLiquidityData = liquidity['ReferenceToken'];
            const rates = await this.contract.conversionRates([ tokenB ], refLiquidityData.price);
            const expectedUnitPrice = refLiquidityData.price.mul(new BN(10).pow(new BN(18))).div(rates[0]);

            actualUnitPrice.should.be.bignumber.equal(expectedUnitPrice);
        });
    });

});
