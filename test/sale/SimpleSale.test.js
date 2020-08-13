const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress } = require('web3-utils');

const { stringToBytes32, uintToBytes32 } = require('../utils/bytes32');

const Sale = artifacts.require('SimpleSaleMock.sol');
const ERC20 = artifacts.require('ERC20Mock.sol');
const IERC20 = artifacts.require('IERC20.sol');

const sku = stringToBytes32('sku');
const ethPrice = ether('0.01');
const erc20Price = ether('1');

const userData = stringToBytes32('userData');

contract('SimpleSale', function ([_, payout, owner, operator, purchaser]) {
    async function doFreshDeploy(params) {
        let payoutToken;

        this.paymentTokens = [EthAddress];
        this.tokenPrices = [ethPrice];

        if (params.useErc20) {
            const erc20Token = await ERC20.new(ether('1000000000'), { from: params.owner });
            await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
            await erc20Token.transfer(params.purchaser, ether('100000'), { from: params.owner });
            payoutToken = erc20Token.address;
            this.payoutToken = payoutToken;
            this.paymentTokens.push(payoutToken);
            this.tokenPrices.push(erc20Price);
        } else {
            payoutToken = ZeroAddress;
            this.payoutToken = EthAddress;
        }

        this.contract = await Sale.new(params.payout, payoutToken, { from: params.owner });

        this.skus = [sku];

        await this.contract.addSkus(this.skus, { from: params.owner });
        await this.contract.addPaymentTokens(this.paymentTokens, { from: params.owner });
        await this.contract.setSkuTokenPrices(sku, this.paymentTokens, this.tokenPrices, { from: params.owner });
        await this.contract.start({ from: params.owner });
    };

    describe('Purchasing', async function () {
        function simplePurchase(payout, owner, operator, purchaser, useErc20) {
            async function getPrice(sale, paymentToken, quantity) {
                const unitPrice = await sale.getPrice(sku, paymentToken)
                return unitPrice.mul(new BN(quantity));
            }

            async function purchaseFor(sale, purchaser, paymentToken, quantity, operator, overrides) {
                const price = await getPrice(sale, paymentToken, quantity);

                let value = price;

                if (overrides) {
                    if (overrides.value !== undefined) {
                        value = overrides.value;
                    }
                }

                let etherValue = value;

                if (paymentToken != EthAddress) {
                    const ERC20Contract = await IERC20.at(paymentToken);
                    // approve first for sale
                    await ERC20Contract.approve(sale.address, value, { from: operator });
                    // do not send any ether
                    etherValue = 0;
                }

                return sale.purchaseFor(
                    purchaser,
                    paymentToken,
                    sku,
                    quantity,
                    userData,
                    {
                        from: operator,
                        value: etherValue,
                        gasPrice: 1
                    }
                );
            }

            async function getBalance(token, address) {
                const contract = await ERC20.at(token);
                return await contract.balanceOf(address);
            }

            async function testPurchases(operator, overvalue) {
                const quantities = [One, new BN('10'), new BN('1000')];
                for (const quantity of quantities) {
                    it('<this.test.title>', async function () {
                        const unitPrice = (this.payoutToken == EthAddress) ? ethPrice : erc20Price;
                        const totalPrice = (new BN(unitPrice)).mul(quantity);

                        this.test.title = `purchasing ${quantity.toString()} items for ${fromWei(totalPrice.toString())} ${this.payoutToken == EthAddress ? 'ETH' : 'ERC20'}`;

                        const priceFromContract = await getPrice(this.contract, this.payoutToken, quantity);
                        priceFromContract.should.be.bignumber.equal(totalPrice);

                        const balanceBefore =
                            this.payoutToken == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.payoutToken, operator);

                        const receipt = await purchaseFor(this.contract, purchaser, this.payoutToken, quantity, operator, {value: totalPrice.add(overvalue)});

                        expectEvent.inTransaction(
                            receipt.tx,
                            this.contract,
                            'Purchased',
                            {
                                purchaser: purchaser,
                                operator: operator,
                                sku: sku,
                                quantity: quantity,
                                paymentToken: toChecksumAddress(this.payoutToken),
                                userData: userData,
                                purchaseData: [ uintToBytes32(totalPrice) ]
                            });

                        const balanceAfter =
                            this.payoutToken == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.payoutToken, operator);

                        const balanceDiff = balanceBefore.sub(balanceAfter);

                        if (this.payoutToken == EthAddress) {
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
                    await doFreshDeploy.bind(this)({
                        payout: payout,
                        owner: owner,
                        operator: operator,
                        purchaser: purchaser,
                        useErc20: useErc20});
                });

                it('when the value is insufficient', async function () {
                    const unitPrice = await getPrice(this.contract, this.payoutToken, One);

                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            this.payoutToken,
                            Two,
                            purchaser,
                            { value: unitPrice }),
                        useErc20 ?
                            'ERC20: transfer amount exceeds allowance' :
                            'SimplePayment: insufficient ETH provided');
                });
            });

            describe('should emit a Purchased event and update balances', async function () {
                describe('when buying for oneself', async function () {
                    describe('with exact amount', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                payout: payout,
                                owner: owner,
                                operator: operator,
                                purchaser: purchaser,
                                useErc20: useErc20});
                        });
                        await testPurchases(purchaser, Zero);
                    });
                    describe('with overvalue (change)', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                payout: payout,
                                owner: owner,
                                operator: operator,
                                purchaser: purchaser,
                                useErc20: useErc20});
                        });
                        await testPurchases(purchaser, ether('1'));
                    });
                });

                describe('when buying via operator', async function () {
                    describe('with exact amount', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                payout: payout,
                                owner: owner,
                                operator: operator,
                                purchaser: purchaser,
                                useErc20: useErc20});
                        });
                        await testPurchases(operator, Zero);
                    });
                    describe('with overvalue (change)', async function () {
                        before(async function () {
                            await doFreshDeploy.bind(this)({
                                payout: payout,
                                owner: owner,
                                operator: operator,
                                purchaser: purchaser,
                                useErc20: useErc20});
                        });
                        await testPurchases(operator, ether('1'));
                    });
                });

            });
        }

        describe('purchase with ether', async function () {
            simplePurchase(payout, owner, operator, purchaser, false);
        });

        describe('purchase with ERC20', async function () {
            simplePurchase(payout, owner, operator, purchaser, true);
        });
    });
});
