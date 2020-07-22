const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress, asciiToHex, padRight } = require('web3-utils');

const Sale = artifacts.require('SimpleSaleMock.sol');
const ERC20 = artifacts.require('ERC20Mock.sol');
const IERC20 = artifacts.require('IERC20.sol');

const prices = {
    'both': {
        ethPrice: ether('0.01'),
        erc20Price: ether('1')
    },
    'ethOnly': {
        ethPrice: ether('0.01'),
        erc20Price: new BN('0')
    },
    'erc20Only': {
        ethPrice: new BN('0'),
        erc20Price: ether('1')
    },
};

const purchaseData = asciiToHex('some data');

contract('SimpleSale', function ([_, payout, owner, operator, purchaser]) {
    async function doFreshDeploy(params) {
        let payoutToken;

        this.supportedPayoutTokens = [EthAddress];

        if (params.useErc20) {
            const erc20Token = await ERC20.new(ether('1000000000'), { from: params.owner });
            await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
            await erc20Token.transfer(params.purchaser, ether('100000'), { from: params.owner });
            payoutToken = erc20Token.address;
            this.payoutToken = payoutToken;
            this.supportedPayoutTokens.push(payoutToken);
        } else {
            payoutToken = ZeroAddress;
            this.payoutToken = EthAddress;
        }

        this.contract = await Sale.new(params.payout, payoutToken, { from: params.owner });

        this.inventorySkus = Object.keys(prices).map(item => asciiToHex(item));
        await this.contract.addInventorySkus(this.inventorySkus, { from: params.owner });
        await this.contract.addSupportedPayoutTokens(this.supportedPayoutTokens, { from: params.owner });

        for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
            const sku = asciiToHex(purchaseId);

            if (this.payoutToken == EthAddress) {
                await this.contract.setSkuTokenPrices(
                    sku,
                    [ EthAddress ],
                    [ prices[purchaseId].ethPrice ],
                    { from: params.owner });
            } else {
                await this.contract.setSkuTokenPrices(
                    sku,
                    [
                        EthAddress,
                        this.payoutToken
                    ],
                    [
                        prices[purchaseId].ethPrice,
                        prices[purchaseId].erc20Price
                    ],
                    { from: params.owner });
            }
        }

        await this.contract.start({ from: params.owner });
    };

    describe('Purchasing', async function () {
        function simplePurchase(payout, owner, operator, purchaser, useErc20) {
            async function getPrice(sale, paymentToken, purchaseId, quantity) {
                const sku = asciiToHex(purchaseId);
                const unitPrice = await sale.getPrice(sku, paymentToken)
                return unitPrice.mul(new BN(quantity));
            }

            async function purchaseFor(sale, purchaser, paymentToken, purchaseId, quantity, operator, overrides) {
                const price = await getPrice(sale, paymentToken, purchaseId, quantity);

                let value = price;

                if (overrides) {
                    if (overrides.purchaseId !== undefined) {
                        purchaseId = overrides.purchaseId;
                    }

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

                const sku = asciiToHex(purchaseId);

                // console.log(`Purchasing ${quantity}*'${purchaseId}'`);
                return sale.purchaseFor(
                    purchaser,
                    paymentToken,
                    sku,
                    quantity,
                    [ purchaseData ],
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
                for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
                    const sku = asciiToHex(purchaseId);
                    const quantities = [One, new BN('10'), new BN('1000')];
                    for (const quantity of quantities) {
                        it('<this.test.title>', async function () {
                            const unitPrice = (this.payoutToken == EthAddress) ? ethPrice : erc20Price;
                            const totalPrice = (new BN(unitPrice)).mul(quantity);

                            this.test.title = `purchasing ${quantity.toString()} * '${purchaseId}' for ${fromWei(totalPrice.toString())} ${this.payoutToken == EthAddress ? 'ETH' : 'ERC20'}`;

                            const priceFromContract = await getPrice(this.contract, this.payoutToken, purchaseId, quantity);
                            priceFromContract.should.be.bignumber.equal(totalPrice);

                            if (totalPrice.eq(Zero)) {
                                await expectRevert(
                                    purchaseFor(
                                        this.contract,
                                        purchaser,
                                        this.payoutToken,
                                        purchaseId,
                                        quantity,
                                        operator),
                                    'SimpleSale: invalid SKU');
                            } else {
                                const balanceBefore =
                                    this.payoutToken == EthAddress ?
                                        await balance.current(operator) :
                                        await getBalance(this.payoutToken, operator);

                                const receipt = await purchaseFor(this.contract, purchaser, this.payoutToken, purchaseId, quantity, operator, {value: totalPrice.add(overvalue)});

                                expectEvent.inTransaction(
                                    receipt.tx,
                                    this.contract,
                                    'Purchased',
                                    {
                                        purchaser: purchaser,
                                        operator: operator,
                                        sku: padRight(sku, 64),
                                        quantity: quantity,
                                        paymentToken: toChecksumAddress(this.payoutToken),
                                        extData: [
                                            '0x' + totalPrice.toString(16, 64),
                                            padRight(purchaseData, 64)]
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
                            }
                        });
                    }
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

                it('when the purchaser is the zero address', async function () {
                    for (const purchaseId of Object.keys(prices)) {
                        await expectRevert(
                            purchaseFor(
                                this.contract,
                                ZeroAddress,
                                this.payoutToken,
                                purchaseId,
                                One,
                                purchaser),
                            'SimpleSale: purchaser cannot be the zero address');
                    }
                });

                it('when the purchaser is the contract address', async function () {
                    for (const purchaseId of Object.keys(prices)) {
                        await expectRevert(
                            purchaseFor(
                                this.contract,
                                this.contract.address,
                                this.payoutToken,
                                purchaseId,
                                One,
                                purchaser),
                            'SimpleSale: purchaser cannot be the contract address');
                    }
                });

                it('when quantity == 0', async function () {
                    for (const purchaseId of Object.keys(prices)) {
                        await expectRevert(
                            purchaseFor(
                                this.contract,
                                purchaser,
                                this.payoutToken,
                                purchaseId,
                                Zero,
                                purchaser),
                            'SimpleSale: quantity cannot be zero');
                    }
                });

                it('when paymentToken is not a supported type', async function() {
                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c',
                            'both',
                            One,
                            purchaser),
                        'SkuTokenPrice: unsupported token');
                });

                it('when purchaseId does not exist', async function () {
                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            this.payoutToken,
                            'invalid',
                            One,
                            purchaser),
                        'SkuTokenPrice: non-existent sku');
                });

                it('when the value is insufficient', async function () {
                    const unitPrice = await getPrice(this.contract, this.payoutToken, 'both', One);

                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            this.payoutToken,
                            'both',
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
