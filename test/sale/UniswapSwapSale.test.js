const { BN, balance, ether, time, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32, bytes32ArrayToBytes, uintToBytes32 } = require('../utils/bytes32');
const Fixture = require('../utils/fixture');
const Path = require('path');
const Resolver = require('@truffle/resolver');
const UniswapV2Fixture = require('../fixtures/uniswapv2.fixture');

const {
    purchasingScenario
} = require('../scenarios');

const resolver = new Resolver({
    working_directory: __dirname,
    contracts_build_directory: Path.join(__dirname, '../../build'),
    provider: web3.eth.currentProvider,
    gas: 9999999
});

const WETH9 = resolver.require('WETH9', UniswapV2Fixture.UniswapV2PeripheryBuildPath);

const Sale = artifacts.require('UniswapSwapSaleMock');
const ERC20 = artifacts.require('ERC20Mock');

const skusCapacity = One;
const tokensPerSkuCapacity = Four;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;

contract('UniswapSwapSale', function (accounts) {
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
        'TokenD': {
            abstraction: ERC20,
            supply: ether('1000')}
    };

    const tokenPairs = {
        'Pair1': ['WETH', 'ReferenceToken'],
        'Pair2': ['TokenA', 'ReferenceToken'],
        'Pair3': ['TokenB', 'ReferenceToken'],
        'Pair4': ['TokenC', 'ReferenceToken']
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
            price: new BN('3000000')},
        'TokenC': {
            amount: new BN('1000000'),
            price: new BN('1000')}
    };

    const [
        owner,
        payoutWallet,
        purchaser,
        recipient
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
        this.erc20Token = await ERC20.new(
            params.erc20TokenSupply || ether('1000'),
            { from: owner });

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
        this.oraclePrice = await this.contract.PRICE_VIA_ORACLE();

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

    before(async function () {
        UniswapV2Fixture.reset();
    });

    beforeEach(async function () {
        await doLoadFixture.bind(this)();
    });

    describe('_validation()', function () {

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('should revert if the purchase user data is undefined', async function () {
            const userData = '0x';

            await expectRevert(
                this.contract.callUnderscoreValidation(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    One,
                    userData),
                'UniswapSwapSale: Missing expected purchase user data');
        });

        it('should revert if the purchase user data is missing information', async function () {
            const userData = bytes32ArrayToBytes([uintToBytes32(Zero)]);

            await expectRevert(
                this.contract.callUnderscoreValidation(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    One,
                    userData),
                'UniswapSwapSale: Missing expected purchase user data');
        });

    });

    describe('_payment()', function () {

        function isEthToken(token, overrides = {}) {
            return token === (overrides.ethTokenAddress || this.ethTokenAddress);
        }

        async function getBalance(token, account, overrides = {}) {
            if (isEthToken.bind(this)(token, overrides)) {
                return await balance.current(account);
            } else {
                const contract = await ERC20.at(token);
                return await contract.balanceOf(account);
            }
        }

        async function doCallUnderscorePayment(purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
            const contract = overrides.contract || this.contract;

            const result = await contract.callUnderscorePricing(
                recipient,
                token,
                sku,
                quantity,
                userData,
                { from: purchaser });

            const totalPrice = result.totalPrice;
            const pricingData = result.pricingData;

            let amount = overrides.amount || totalPrice;
            let amountVariance = overrides.amountVariance;

            if (!amountVariance) {
                amountVariance = Zero;
            }

            amount = amount.add(amountVariance);

            let etherValue;

            if (isEthToken.bind(this)(token, overrides)) {
                etherValue = amount;
            } else {
                const erc20Contract = await ERC20.at(token);
                await erc20Contract.approve(contract.address, amount, { from: purchaser });
                etherValue = Zero;
            }

            const callUnderscorePayment = contract.callUnderscorePayment(
                recipient,
                token,
                sku,
                quantity,
                userData,
                totalPrice,
                pricingData,
                {
                    from: purchaser,
                    value: etherValue
                });

            return {
                callUnderscorePayment,
                totalPrice
            };
        }

        async function shouldHandlePayment(purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
            const balanceBefore = await getBalance.bind(this)(token, purchaser, overrides);

            const {
                callUnderscorePayment,
                totalPrice
            } = await doCallUnderscorePayment.bind(this)(
                purchaser,
                recipient,
                token,
                sku,
                quantity,
                userData,
                overrides
            );

            const receipt = await callUnderscorePayment;
            const contract = overrides.contract || this.contract;

            const balanceAfter = await getBalance.bind(this)(token, purchaser, overrides);
            const balanceDiff = balanceBefore.sub(balanceAfter);

            if (isEthToken.bind(this)(token, overrides)) {
                const gasUsed = new BN(receipt.receipt.gasUsed);
                const gasPrice = new BN(await web3.eth.getGasPrice());
                balanceDiff.should.be.bignumber.equal(totalPrice.add(gasUsed.mul(gasPrice)));
            } else {
                balanceDiff.should.be.bignumber.equal(totalPrice);
            }
        }

        async function shouldRevertAndNotHandlePayment(revertMessage, purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
            const {
                callUnderscorePayment
            } = await doCallUnderscorePayment.bind(this)(
                purchaser,
                recipient,
                token,
                sku,
                quantity,
                userData,
                overrides
            );

            if (revertMessage) {
                await expectRevert(callUnderscorePayment, revertMessage);
            } else {
                await expectRevert.unspecified(callUnderscorePayment);
            }
        }

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doStart.bind(this)();

            await tokens['TokenA'].contract.transfer(purchaser, ether('1'));
            await tokens['TokenA'].contract.transfer(recipient, ether('1'));
            await tokens['ReferenceToken'].contract.transfer(this.contract.address, ether('1'));

            this.erc20TokenAddress = tokens['TokenA'].contract.address;
        });

        describe('when paying with ERC20', function () {

            const quantity = One;

            describe('when the payment token max amount to swap is insufficient', function () {

                it('should revert and not handle payment', async function () {
                    const unitPrice = liquidity['ReferenceToken'].price;
                    const totalPrice = unitPrice.mul(quantity);

                    const fromAmount = await this.contract.callUnderscoreEstimateSwap(
                        this.erc20TokenAddress,
                        tokens['ReferenceToken'].contract.address,
                        totalPrice,
                        '0x');

                    const userData = bytes32ArrayToBytes([uintToBytes32(fromAmount.subn(1))]);

                    await shouldRevertAndNotHandlePayment.bind(this)(
                        'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT',
                        purchaser,
                        recipient,
                        this.erc20TokenAddress,
                        sku,
                        quantity,
                        userData);
                });

            });

            describe('when the payment token max amount to swap is sufficient', function () {

                it('should handle payment', async function () {
                    const unitPrice = liquidity['ReferenceToken'].price;
                    const totalPrice = unitPrice.mul(quantity);

                    const fromAmount = await this.contract.callUnderscoreEstimateSwap(
                        this.erc20TokenAddress,
                        tokens['ReferenceToken'].contract.address,
                        totalPrice,
                        '0x00');

                    const userData = bytes32ArrayToBytes([uintToBytes32(fromAmount)]);

                    await shouldHandlePayment.bind(this)(
                        purchaser,
                        recipient,
                        this.erc20TokenAddress,
                        sku,
                        quantity,
                        userData);
                });

            });

            describe('when the payment token max amount to swap is more than sufficient', function () {

                it('should handle payment', async function () {
                    const unitPrice = liquidity['ReferenceToken'].price;
                    const totalPrice = unitPrice.mul(quantity);

                    const fromAmount = await this.contract.callUnderscoreEstimateSwap(
                        this.erc20TokenAddress,
                        tokens['ReferenceToken'].contract.address,
                        totalPrice,
                        '0x00');

                    const userData = bytes32ArrayToBytes([uintToBytes32(fromAmount.addn(1))]);

                    await shouldHandlePayment.bind(this)(
                        purchaser,
                        recipient,
                        this.erc20TokenAddress,
                        sku,
                        quantity,
                        userData);
                });

            });

            describe('when the payment token max amount to swap is the maximum amount supported', function () {

                it('should handle payment', async function () {
                    const userData = bytes32ArrayToBytes([uintToBytes32(Zero)]);

                    await shouldHandlePayment.bind(this)(
                        purchaser,
                        recipient,
                        this.erc20TokenAddress,
                        sku,
                        quantity,
                        userData);
                });

            });

        });

    });

    describe('_estimateSwap()', function () {

        const userData = bytes32ArrayToBytes([uintToBytes32(Zero), uintToBytes32(Zero)]);

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
        });

        it('should revert if the source token is the zero address', async function () {
            await expectRevert(
                this.contract.callUnderscoreEstimateSwap(
                    ZeroAddress,
                    tokens['TokenA'].contract.address,
                    liquidity['ReferenceToken'].price,
                    userData),
                'UniswapV2Library: ZERO_ADDRESS');
        });

        it('should revert if the destination token is the zero address', async function () {
            await expectRevert(
                this.contract.callUnderscoreEstimateSwap(
                    tokens['TokenA'].contract.address,
                    ZeroAddress,
                    liquidity['ReferenceToken'].price,
                    userData),
                'UniswapV2Library: ZERO_ADDRESS');
        });

        it('should revert if the source and destination token are the same', async function () {
            await expectRevert(
                this.contract.callUnderscoreEstimateSwap(
                    tokens['TokenA'].contract.address,
                    tokens['TokenA'].contract.address,
                    liquidity['ReferenceToken'].price,
                    userData),
                'UniswapV2Library: IDENTICAL_ADDRESSES');
        });

        it('should revert if the source token does not belong to a token pair', async function () {
            await expectRevert(
                this.contract.callUnderscoreEstimateSwap(
                    tokens['TokenD'].contract.address,
                    tokens['TokenA'].contract.address,
                    liquidity['ReferenceToken'].price,
                    userData),
                'revert');
        });

        it('should revert if the destination token does not belong to a token pair', async function () {
            await expectRevert(
                this.contract.callUnderscoreEstimateSwap(
                    tokens['TokenA'].contract.address,
                    tokens['TokenD'].contract.address,
                    liquidity['ReferenceToken'].price,
                    userData),
                'revert');
        });

        describe(`should return a swap estimate`, async function () {

            it('when the source token is an ERC20', async function () {
                const fromToken = tokens['TokenA'].contract.address;
                const toToken = tokens['ReferenceToken'].contract.address;

                const fromAmount = await this.contract.callUnderscoreEstimateSwap(
                    fromToken,
                    toToken,
                    liquidity['ReferenceToken'].price,
                    userData);

                fromAmount.should.be.bignumber.not.equal(Zero);
            });

            it('when the source token is ETH', async function () {
                const fromToken = await this.contract.TOKEN_ETH();
                const toToken = tokens['ReferenceToken'].contract.address;

                const fromAmount = await this.contract.callUnderscoreEstimateSwap(
                    fromToken,
                    toToken,
                    liquidity['ReferenceToken'].price,
                    userData);

                fromAmount.should.be.bignumber.not.equal(Zero);
            });

        });

    });

    describe.skip('TODO: _swap()', function () {

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('TODO: write the _swap() tests', async function () {
            // const fromTokenAddress = await this.contract.TOKEN_ETH();
            // const toToken = tokens['ReferenceToken'].contract;
            // const toAmount = liquidity['ReferenceToken'].price;
            // const data = bytes32ArrayToBytes([uintToBytes32(Zero), uintToBytes32(Zero)]);
            //
            // const expectedFromAmount = await this.contract.callUnderscoreEstimateSwap(
            //     fromTokenAddress,
            //     toToken.address,
            //     toAmount,
            //     data);
            //
            // const receipt = await this.contract.callUnderscoreSwap(
            //     fromTokenAddress,
            //     toToken.address,
            //     toAmount,
            //     data,
            //     {
            //         from: purchaser,
            //         value: expectedFromAmount
            //     });
            //
            // const events = await this.contract.getPastEvents(
            //     'UnderscoreSwapResult',
            //     { fromBlock: 'latest' });
            //
            // const actualFromAmount = events[0].args.fromAmount;

            false.should.be.true;
        });

    });

    describe.skip('TODO: scenarios', function () {

        beforeEach(async function () {
            await doAddLiquidity.bind(this)();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doStart.bind(this)();
        });

        describe('purchasing', function () {

            const userData = bytes32ArrayToBytes([uintToBytes32(Zero), uintToBytes32(Zero)]);

            beforeEach(async function () {
                this.erc20TokenAddress = tokens['TokenA'].contract.address;

                const erc20TokenContract = await ERC20.at(this.erc20TokenAddress);
                await erc20TokenContract.transfer(purchaser, ether('1'));
                await erc20TokenContract.transfer(recipient, ether('1'));

                await this.contract.addEth({
                    from: owner,
                    value: ether('1')
                });

                await tokens['ReferenceToken'].contract.transfer(
                    this.contract.address,
                    ether('1'));
            });

            it('TODO: fix the balance test in the shouldPurchaseFor() behavior', async function () {
                false.should.be.true;
            });

            // This is currently failing because of the balance test in the
            // shouldPurchaseFor() behavior. It's relying on the estimate total
            // amount in the test against the actual amount, and the estimate
            // is not always accurate to what was actually spent in payment.
            purchasingScenario([ purchaser, recipient ], sku, userData);

        });

    });

});
