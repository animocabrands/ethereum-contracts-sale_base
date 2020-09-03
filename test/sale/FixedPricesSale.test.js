const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress } = require('web3-utils');

const { stringToBytes32 } = require('../utils/bytes32');

const Sale = artifacts.require('FixedPricesSaleMock.sol');
const ERC20 = artifacts.require('ERC20Mock.sol');
const IERC20 = artifacts.require('IERC20.sol');

const sku = stringToBytes32('sku');
const skuTotalSupply = Two;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;
const ethPrice = ether('0.01');
const erc20Price = ether('1');
const userData = stringToBytes32('userData');

const skusCapacity = One;
const tokensPerSkuCapacity = One;

const erc20TotalSupply = ether('1000000000');
const purchaserErc20Balance = ether('100000');
const recipientErc20Balance = ether('100000')

contract('FixedPricesSale', function ([_, payoutWallet, owner, purchaser, recipient]) {
    async function doFreshDeploy(params) {
        this.contract = await Sale.new(
            params.payoutWallet || payoutWallet,
            params.skusCapacity || skusCapacity,
            params.tokensPerSkuCapacity || tokensPerSkuCapacity,
            { from: params.owner || owner });

        await this.contract.createSku(
            params.sku || sku,
            params.skuTotalSupply || skuTotalSupply,
            params.skuMaxQuantityPerPurchase || skuMaxQuantityPerPurchase,
            params.skuNotificationsReceiver || skuNotificationsReceiver,
            { from: params.owner || owner });

        this.ethTokenAddress = await this.contract.TOKEN_ETH();

        if (params.useErc20) {
            this.erc20Token = await ERC20.new(
                params.erc20TotalSupply || erc20TotalSupply,
                { from: params.owner || owner });

            await this.erc20Token.transfer(
                params.purchaser || purchaser,
                params.purchaserErc20Balance || purchaserErc20Balance,
                { from: params.owner || owner });

            await this.erc20Token.transfer(
                params.recipient || recipient,
                params.recipientErc20Balance || recipientErc20Balance,
                { from: params.owner || owner });

            this.tokenAddress = this.erc20Token.address;
            this.tokenPrice = params.erc20Price || erc20Price;
        } else {
            this.tokenAddress = this.ethTokenAddress;
            this.tokenPrice = params.ethPrice || ethPrice;
        }

        await this.contract.updateSkuPricing(
            params.sku || sku,
            [ this.tokenAddress ],
            [ this.tokenPrice ],
            { from: owner });

        await this.contract.start({ from: params.owner || owner });
    };

    describe('Purchase', async function () {
        function purchase(useErc20) {
            async function purchaseFor(purchaser, recipient, token, sku, quantity, userData, overrides) {
                const estimatePurchase = await this.contract.estimatePurchase(
                    recipient,
                    token,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser });

                let amount = estimatePurchase.totalPrice;

                if (overrides) {
                    if (overrides.amount !== undefined) {
                        amount = overrides.amount;
                    }
                }

                let etherValue;

                if (token === this.ethTokenAddress) {
                    etherValue = amount;
                } else {
                    const ERC20Contract = await IERC20.at(token);
                    // approve first for sale
                    await ERC20Contract.approve(this.contract.address, amount, { from: purchaser });
                    // do not send any ether
                    etherValue = 0;
                }

                return this.contract.purchaseFor(
                    recipient,
                    token,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: etherValue,
                        gasPrice: 1
                    });
            }

            async function getBalance(token, address) {
                const contract = await ERC20.at(token);
                return await contract.balanceOf(address);
            }

            async function testPurchases(quantities, operator, overvalue) {
                for (const quantity of quantities) {
                    it('<this.test.title>', async function () {
                        const estimate = await this.contract.estimatePurchase(
                            recipient,
                            this.tokenAddress,
                            sku,
                            quantity,
                            userData,
                            { from: operator });

                        const totalPrice = estimate.totalPrice;

                        this.test.title = `purchasing ${quantity.toString()} items for ${fromWei(totalPrice.toString())} ${this.token == this.ethTokenAddress ? 'ETH' : 'ERC20'}`;

                        const balanceBefore =
                            this.tokenAddress == this.ethTokenAddress ?
                                await balance.current(operator) :
                                await getBalance(this.tokenAddress, operator);

                        const receipt = await purchaseFor.bind(this)(
                            operator,
                            recipient,
                            this.tokenAddress,
                            sku,
                            quantity,
                            userData,
                            { amount: totalPrice.add(overvalue) });

                        expectEvent.inTransaction(
                            receipt.tx,
                            this.contract,
                            'Purchase',
                            {
                                purchaser: operator,
                                recipient: recipient,
                                token: toChecksumAddress(this.tokenAddress),
                                sku: sku,
                                quantity: quantity,
                                userData: userData,
                                totalPrice: totalPrice
                            });

                        const balanceAfter =
                            this.tokenAddress == this.ethTokenAddress ?
                                await balance.current(operator) :
                                await getBalance(this.tokenAddress, operator);

                        const balanceDiff = balanceBefore.sub(balanceAfter);

                        if (this.tokenAddress == this.ethTokenAddress) {
                            const gasUsed = new BN(receipt.receipt.gasUsed);
                            balanceDiff.should.be.bignumber.equal(totalPrice.add(gasUsed));
                        } else {
                            balanceDiff.should.be.bignumber.equal(totalPrice);
                        }
                    });
                }
            }

            describe('reverts', function () {
                before(async function () {
                    await doFreshDeploy.bind(this)({ useErc20: useErc20 });
                });

                it('when the payment amount is insufficient', async function () {
                    const estimate = await this.contract.estimatePurchase(
                        recipient,
                        this.tokenAddress,
                        sku,
                        One,
                        userData,
                        { from: purchaser });

                    const unitPrice = estimate.totalPrice;

                    await expectRevert(
                        purchaseFor.bind(this)(
                            purchaser,
                            recipient,
                            this.tokenAddress,
                            sku,
                            Two,
                            userData,
                            { amount: unitPrice }),
                            useErc20 ?
                                'ERC20: transfer amount exceeds allowance' :
                                'Sale: insufficient ETH provided');
                });
            });

            describe('should emit a Purchase event and update balances', async function () {
                const quantities = [One, new BN('10'), new BN('1000')];

                const skuTotalSupply = quantities.reduce((sum, value) => {
                    return sum.add(value);
                });

                const skuMaxQuantityPerPurchase = quantities.reduce((max, value) => {
                    return BN.max(max, value);
                });

                describe('when buying for oneself', async function () {
                    describe('with exact amount', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                skuTotalSupply: skuTotalSupply,
                                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                                useErc20: useErc20
                            });
                        });

                        await testPurchases(quantities, purchaser, Zero);
                    });

                    describe('with overvalue (change)', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                skuTotalSupply: skuTotalSupply,
                                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                                useErc20: useErc20
                            });
                        });

                        await testPurchases(quantities, purchaser, ether('1'));
                    });
                });

                describe('when buying via operator', async function () {
                    describe('with exact amount', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                skuTotalSupply: skuTotalSupply,
                                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                                useErc20: useErc20
                            });
                        });

                        await testPurchases(quantities, recipient, Zero);
                    });

                    describe('with overvalue (change)', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                skuTotalSupply: skuTotalSupply,
                                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                                useErc20: useErc20
                            });
                        });

                        await testPurchases(quantities, recipient, ether('1'));
                    });
                });
            });
        }

        describe('purchase with ether', async function () {
            purchase(false);
        });

        describe('purchase with ERC20', async function () {
            purchase(true);
        });
    });
});
