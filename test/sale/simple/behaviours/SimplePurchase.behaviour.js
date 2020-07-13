const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress, asciiToHex, padRight } = require('web3-utils');

const { doFreshDeploy, prices, purchaseFor, getPrice, purchaseData } = require('../shared.js');

const ERC20 = artifacts.require('ERC20Mock.sol');

async function getBalance(token, address) {
    const contract = await ERC20.at(token);
    return await contract.balanceOf(address);
}

function simplePurchase(payout, owner, operator, purchaser, useErc20) {

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
                    'SimpleSale: insufficient ETH provided');
        });
    });

    const testPurchases = async function (operator, overvalue) {
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
                        await expectRevert.unspecified(
                            purchaseFor(this.contract, purchaser, purchaseId, quantity, this.payoutToken, operator)
                        );
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
                                    '0x' + unitPrice.toString(16, 64),
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

module.exports = simplePurchase;
