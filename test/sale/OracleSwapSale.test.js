const { BN, balance, ether, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three, Four } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32, bytes32ToUint } = require('../utils/bytes32');

const {
    purchasingScenario
} = require('../scenarios');

const Sale = artifacts.require('OracleSwapSaleMock');
const ERC20 = artifacts.require('ERC20Mock');

const skusCapacity = One;
const tokensPerSkuCapacity = Four;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;

const referenceTokenPrice = new BN('1000');

contract('OracleSwapSale', function (accounts) {

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

    async function doSetSwapRates(params = {}) {
        const tokenRates = {};
        tokenRates[this.referenceToken.address] = params.referenceTokenRate != undefined ? params.referenceTokenRate : ether('1');
        tokenRates[this.ethTokenAddress] = params.ethTokenRate != undefined ? params.ethTokenRate : ether('2');
        tokenRates[this.erc20Token.address] = params.erc20Rate != undefined ? params.erc20Rate : ether('0.5');

        for (const [token, rate] of Object.entries(tokenRates)) {
            await this.contract.setMockSwapRate(
                token,
                this.referenceToken.address,
                rate);
        }
    }

    async function doStart(params = {}) {
        return await this.contract.start({ from: params.owner || owner });
    };

    describe('swapRates()', function () {

        const userData = stringToBytes32('userData');

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('should revert if the oracle does not provide a swap rate for one of the pairs', async function () {
            await expectRevert(
                this.contract.swapRates(
                    [ this.ethTokenAddress ],
                    referenceTokenPrice,
                    userData),
                'OracleSwapSaleMock: undefined swap rate');
        });

        it(`should return the correct swap rates`, async function () {
            await doSetSwapRates.bind(this)();

            const tokens = [
                this.referenceToken.address,
                this.ethTokenAddress,
                this.erc20Token.address
            ];

            const actualRates = await this.contract.swapRates(
                tokens,
                referenceTokenPrice,
                userData);

            const expectedRates = [];

            for (const token of tokens) {
                const rate = await this.contract.mockSwapRates(
                    token,
                    this.referenceToken.address);
                expectedRates.push(rate);
            }

            for (var index = 0; index < tokens.length; ++index) {
                actualRates[index].should.be.bignumber.equal(expectedRates[index]);
            }
        });

    });

    describe('_pricing()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should revert if the SKU does not exist', async function () {
            const otherSku = stringToBytes32('other sku');

            await expectRevert(
                this.contract.callUnderscorePricing(
                    ZeroAddress,
                    this.erc20Token.address,
                    otherSku,
                    One,
                    '0x00'),
                'Sale: unsupported SKU');
        });

        it('should revert if the payment token is not supported by the SKU', async function () {
            const otherToken = await ERC20.new(
                ether('1000'),
                { from: owner });

            await expectRevert(
                this.contract.callUnderscorePricing(
                    ZeroAddress,
                    otherToken.address,
                    sku,
                    One,
                    '0x00'),
                'EnumMap: nonexistent key');
        });

        it('should set the fixed total price', async function () {
            const ethTokenUnitFixedPrice = ether('3');

            await doUpdateSkuPricing.bind(this)({
                prices: [
                    One, // reference token
                    ethTokenUnitFixedPrice, // ETH token
                    One] // ERC20 token
            });

            const result = await this.contract.callUnderscorePricing(
                ZeroAddress,
                this.ethTokenAddress,
                sku,
                One,
                '0x00');

            const actualTotalPrice = result.totalPrice;
            const expectedTotalPrice = ethTokenUnitFixedPrice;

            actualTotalPrice.should.be.bignumber.equal(expectedTotalPrice);

            const pricingData = result.pricingData;
            pricingData.length.should.be.equal(0);
        });

        it('should set the oracle total price (0 < rate < 1)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetSwapRates.bind(this)();

            const swapRate = await this.contract.mockSwapRates(
                this.erc20Token.address,
                this.referenceToken.address);

            const result = await this.contract.callUnderscorePricing(
                ZeroAddress,
                this.erc20Token.address,
                sku,
                One,
                '0x00');

            const actualTotalPrice = result.totalPrice;
            const expectedTotalPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(swapRate);

            actualTotalPrice.should.be.bignumber.equal(expectedTotalPrice);

            const pricingData = result.pricingData;

            pricingData.length.should.be.equal(1);

            const actualSwapRate = bytes32ToUint(pricingData[0]);
            const expectedSwapRate = swapRate;

            actualSwapRate.should.be.bignumber.equal(expectedSwapRate);
        });

        it('should set the oracle total price (1 == rate)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetSwapRates.bind(this)();

            const token = await ERC20.new(
                ether('1000'),
                { from: owner });

            await this.contract.updateSkuPricing(
                sku,
                [ token.address ],
                [ this.oraclePrice ],
                { from: owner });

            await this.contract.setMockSwapRate(
                token.address,
                this.referenceToken.address,
                ether('1'));

            const swapRate = await this.contract.mockSwapRates(
                token.address,
                this.referenceToken.address);

            const result = await this.contract.callUnderscorePricing(
                ZeroAddress,
                token.address,
                sku,
                One,
                '0x00');

            const actualTotalPrice = result.totalPrice;
            const expectedTotalPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(swapRate);

            actualTotalPrice.should.be.bignumber.equal(expectedTotalPrice);

            const pricingData = result.pricingData;

            pricingData.length.should.be.equal(1);

            const actualSwapRate = bytes32ToUint(pricingData[0]);
            const expectedSwapRate = swapRate;

            actualSwapRate.should.be.bignumber.equal(expectedSwapRate);
        });

        it('should set the oracle total price (1 < rate)', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doSetSwapRates.bind(this)();

            const swapRate = await this.contract.mockSwapRates(
                this.ethTokenAddress,
                this.referenceToken.address);

            const result = await this.contract.callUnderscorePricing(
                ZeroAddress,
                this.ethTokenAddress,
                sku,
                One,
                '0x00');

            const actualTotalPrice = result.totalPrice;
            const expectedTotalPrice = referenceTokenPrice.mul(new BN(10).pow(new BN(18))).div(swapRate);

            actualTotalPrice.should.be.bignumber.equal(expectedTotalPrice);

            const pricingData = result.pricingData;

            pricingData.length.should.be.equal(1);

            const actualSwapRate = bytes32ToUint(pricingData[0]);
            const expectedSwapRate = swapRate;

            actualSwapRate.should.be.bignumber.equal(expectedSwapRate);
        });

    });

    describe('_payment()', function () {

        const userData = '0x00';

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
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doSetSwapRates.bind(this)();
            await doStart.bind(this)();

            await this.erc20Token.transfer(purchaser, ether('1'));
            await this.erc20Token.transfer(recipient, ether('1'));
            await this.referenceToken.transfer(this.contract.address, ether('1'));

            this.erc20TokenAddress = this.erc20Token.address;
        });

        describe('when paying with ETH', function () {

            describe('when the purchaser and the recipient are the same', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not handle payment', async function () {
                        await shouldRevertAndNotHandlePayment.bind(this)(
                            'Sale: insufficient ETH provided',
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: new BN(-1)
                            });
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: One
                            });
                    });

                });

            });

            describe('when the purchaser and the recipient are different', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not handle payment', async function () {
                        const estimate = await this.contract.estimatePurchase(
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            { from: purchaser });

                        await shouldRevertAndNotHandlePayment.bind(this)(
                            'Sale: insufficient ETH provided',
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: new BN(-1)
                            });
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: One
                            });
                    });

                });

            });

        });

        describe('when paying with ERC20', function () {

            describe('when the purchaser and the recipient are the same', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not handle payment', async function () {
                        await shouldRevertAndNotHandlePayment.bind(this)(
                            'ERC20: transfer amount exceeds allowance',
                            recipient,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: new BN(-1)
                            });
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            recipient,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            recipient,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: One
                            });
                    });

                });

            });

            describe('when the purchaser and the recipient are different', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not handle payment', async function () {
                        await shouldRevertAndNotHandlePayment.bind(this)(
                            'ERC20: transfer amount exceeds allowance',
                            purchaser,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: new BN(-1)
                            });
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            purchaser,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should handle payment', async function () {
                        await shouldHandlePayment.bind(this)(
                            purchaser,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData,
                            {
                                amountVariance: One
                            });
                    });

                });

            });

        });

    });

    describe('scenarios', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
            await doSetSwapRates.bind(this)();
            await doStart.bind(this)();
        });

        describe('purchasing', function () {

            beforeEach(async function () {
                await this.erc20Token.transfer(purchaser, ether('1'));
                await this.erc20Token.transfer(recipient, ether('1'));
                await this.referenceToken.transfer(this.contract.address, ether('1'));

                this.erc20TokenAddress = this.erc20Token.address;
            });

            purchasingScenario([ purchaser, recipient ], sku);

        });

    });

});
