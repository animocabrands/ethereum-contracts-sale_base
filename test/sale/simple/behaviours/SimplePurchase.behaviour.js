const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress, sha3 } = require('web3-utils');

const { doFreshDeploy, prices, purchaseFor, getPrice, purchaseData } = require('../shared.js');

const ERC20 = artifacts.require('IERC20.sol');

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

        it('when quantity == 0', async function () {
            for (const purchaseId of Object.keys(prices)) {
                await expectRevert.unspecified(
                    purchaseFor(this.contract, purchaser, purchaseId, Zero, this.payoutTokenAddress, purchaser)
                );
            }
        });

        it('when paymentToken is not a supported type', async function() {
            await expectRevert.unspecified(
                purchaseFor(this.contract, purchaser, 'both', One, '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c', purchaser)
            );
        });

        it('when purchaseId does not exist', async function () {
            await expectRevert.unspecified(
                purchaseFor(this.contract, purchaser, 'invalid', One, this.payoutTokenAddress, purchaser)
            );
        });

        it('when the value is inssuficient', async function () {
            const unitPrice = await getPrice(this.contract, 'both', One, this.payoutTokenAddress);

            await expectRevert.unspecified(
                purchaseFor(this.contract, purchaser, 'both', Two, this.payoutTokenAddress, purchaser, {
                    value: unitPrice
                })
            );
        });
    });

    const testPurchases = async function (operator, overvalue) {
        for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
            const quantities = [One, new BN('10'), new BN('1000')];
            for (const quantity of quantities) {
                it('<this.test.title>', async function () {
                    const unitPrice = (this.payoutTokenAddress == EthAddress) ? ethPrice : erc20Price;
                    const totalPrice = (new BN(unitPrice)).mul(quantity);

                    this.test.title = `purchasing ${quantity.toString()} * '${purchaseId}' for ${fromWei(totalPrice.toString())} ${this.payoutTokenAddress == EthAddress ? 'ETH' : 'ERC20'}`;

                    const priceFromContract = await getPrice(this.contract, purchaseId, quantity, this.payoutTokenAddress);
                    priceFromContract.should.be.bignumber.equal(totalPrice);

                    if (totalPrice.eq(Zero)) {
                        await expectRevert.unspecified(
                            purchaseFor(this.contract, purchaser, purchaseId, quantity, this.payoutTokenAddress, operator)
                        );
                    } else {
                        const balanceBefore =
                            this.payoutTokenAddress == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.payoutTokenAddress, operator);

                        const receipt = await purchaseFor(this.contract, purchaser, purchaseId, quantity, this.payoutTokenAddress, operator, {value: totalPrice.add(overvalue)});

                        expectEvent.inLogs(receipt.logs, 'Purchased', {
                            purchaser: purchaser,
                            operator: operator,
                            purchaseId: sha3(purchaseId),  // indexed string arg is keccak hashed
                            quantity: quantity,
                            paymentToken: toChecksumAddress(this.payoutTokenAddress),
                            totalPrice: totalPrice,
                            unitPrice: unitPrice,
                            data: purchaseData  // un-indexed string arg is left as-is
                        });

                        const balanceAfter =
                            this.payoutTokenAddress == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.payoutTokenAddress, operator);

                        const balanceDiff = balanceBefore.sub(balanceAfter);

                        if (this.payoutTokenAddress == EthAddress) {
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
