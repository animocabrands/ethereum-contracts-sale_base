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

contract.only('SimpleSale', function ([_, payout, owner, operator, purchaser]) {
    async function doFreshDeploy(params) {
        let payoutToken;

        if (params.useErc20) {
            const erc20Token = await ERC20.new(ether('1000000000'), { from: params.owner });
            await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
            await erc20Token.transfer(params.purchaser, ether('100000'), { from: params.owner });
            payoutToken = erc20Token.address;
            this.payoutToken = payoutToken;
        } else {
            payoutToken = ZeroAddress;
            this.payoutToken = EthAddress;
        }

        this.contract = await Sale.new(params.payout, payoutToken, { from: params.owner });

        if (params.setPrices) {
            for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
                const sku = asciiToHex(purchaseId);
                await this.contract.setPrice(sku, ethPrice, erc20Price, { from: params.owner });
            }
        }

        await this.contract.start({ from: params.owner });
    };

    describe('Purchase IDs Management', function () {
        describe('setPrice()', function () {
            beforeEach(async function () {
                await doFreshDeploy.bind(this)({
                    payout: payout,
                    owner: owner,
                    operator: operator,
                    purchaser: purchaser,
                    useErc20: true,
                    setPrices: false});
            });

            it('should fail if not sent by the owner', async function () {
                const purchaseId = 'both';
                const sku = asciiToHex(purchaseId);
                await expectRevert(
                    this.contract.setPrice(
                        sku,
                        prices[purchaseId].ethPrice,
                        prices[purchaseId].erc20Price,
                        { from: purchaser }),
                    'Ownable: caller is not the owner');
            });

            it('should update the prices and emit a PriceUpdated event', async function () {
                for (const [purchaseId, {ethPrice, erc20Price}] of Object.entries(prices)) {
                    const sku = asciiToHex(purchaseId);
                    const initialPrices = await this.contract.prices(sku);
                    initialPrices.ethPrice.should.be.bignumber.equal(new BN(0));
                    initialPrices.erc20Price.should.be.bignumber.equal(new BN(0));
                    await this.contract.setPrice(sku, ethPrice, erc20Price, { from: owner });
                    const updatedPrices = await this.contract.prices(sku);
                    updatedPrices.ethPrice.should.be.bignumber.equal(ethPrice);
                    updatedPrices.erc20Price.should.be.bignumber.equal(erc20Price);
                }

                for (const [purchaseId, {ethPrice, erc20Price}] of Object.entries(prices)) {
                    const sku = asciiToHex(purchaseId);
                    const { logs } = await this.contract.setPrice(sku, ethPrice, erc20Price, { from: owner });

                    expectEvent.inLogs(logs, 'PriceUpdated', {
                        sku: web3.utils.padRight(sku, 64),
                        ethPrice: ethPrice,
                        erc20Price: erc20Price
                    });
                }

                for (const purchaseId of Object.keys(prices)) {
                    const sku = asciiToHex(purchaseId);
                    const { logs } = await this.contract.setPrice(sku, '0', '0', { from: owner });

                    expectEvent.inLogs(logs, 'PriceUpdated', {
                        sku: web3.utils.padRight(sku, 64),
                        ethPrice: '0',
                        erc20Price: '0'
                    });
                }
            });
        });
    });

    describe('Purchasing', async function () {
        function simplePurchase(payout, owner, operator, purchaser, useErc20) {
            async function getPrice(sale, purchaseId, quantity, paymentToken) {
                const sku = asciiToHex(purchaseId);
                const { ethPrice, erc20Price } = await sale.getPrice(sku);
                return (paymentToken == EthAddress) ? ethPrice.mul(new BN(quantity)) : erc20Price.mul(new BN(quantity));
            }

            async function purchaseFor(sale, purchaser, purchaseId, quantity, paymentToken, operator, overrides) {
                const price = await getPrice(sale, purchaseId, quantity, paymentToken);

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

                            const priceFromContract = await getPrice(this.contract, purchaseId, quantity, this.payoutToken);
                            priceFromContract.should.be.bignumber.equal(totalPrice);

                            if (totalPrice.eq(Zero)) {
                                await expectRevert(
                                    purchaseFor(
                                        this.contract,
                                        purchaser,
                                        purchaseId,
                                        quantity,
                                        this.payoutToken,
                                        operator),
                                    'SimpleSale: invalid SKU');
                            } else {
                                const balanceBefore =
                                    this.payoutToken == EthAddress ?
                                        await balance.current(operator) :
                                        await getBalance(this.payoutToken, operator);

                                const receipt = await purchaseFor(this.contract, purchaser, purchaseId, quantity, this.payoutToken, operator, {value: totalPrice.add(overvalue)});

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
                        useErc20: useErc20,
                        setPrices: true});
                });

                it('when the purchaser is the zero address', async function () {
                    for (const purchaseId of Object.keys(prices)) {
                        await expectRevert(
                            purchaseFor(
                                this.contract,
                                ZeroAddress,
                                purchaseId,
                                One,
                                this.payoutToken,
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
                                purchaseId,
                                One,
                                this.payoutToken,
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
                                purchaseId,
                                Zero,
                                this.payoutToken,
                                purchaser),
                            'SimpleSale: quantity cannot be zero');
                    }
                });

                it('when paymentToken is not a supported type', async function() {
                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            'both',
                            One,
                            '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c',
                            purchaser),
                        'SimpleSale: payment token is unsupported');
                });

                it('when purchaseId does not exist', async function () {
                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            'invalid',
                            One,
                            this.payoutToken,
                            purchaser),
                        'SimpleSale: invalid SKU');
                });

                it('when the value is insufficient', async function () {
                    const unitPrice = await getPrice(this.contract, 'both', One, this.payoutToken);

                    await expectRevert(
                        purchaseFor(
                            this.contract,
                            purchaser,
                            'both',
                            Two,
                            this.payoutToken,
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
                                useErc20: useErc20,
                                setPrices: true});
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
                                useErc20: useErc20,
                                setPrices: true});
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
                                useErc20: useErc20,
                                setPrices: true});
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
                                useErc20: useErc20,
                                setPrices: true});
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
