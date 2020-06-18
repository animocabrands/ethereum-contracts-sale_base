const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress } = require('web3-utils');

const { doFreshDeploy, prices, purchaseFor, getPrice } = require('../shared.js');

const ERC20 = artifacts.require('ERC20.sol');

async function getBalance(token, address) {
    const contract = await ERC20.at(token);
    return await contract.balanceOf(address);
}

function simplePurchase(payout, owner, operator, recipient, useErc20) {

    describe('reverts', function () {
        before(async function () {
            await doFreshDeploy.bind(this)({
                payout: payout,
                owner: owner,
                operator: operator,
                recipient: recipient,
                useErc20: useErc20,
                setPrices: true});
        });

        it('when quantity == 0', async function () {
            for (const purchaseId of Object.keys(prices)) {
                await expectRevert.unspecified(
                    purchaseFor(this.contract, recipient, purchaseId, Zero, this.erc20TokenAddress, recipient)
                );
            }
        });

        it('when paymentToken is not a supported type', async function() {
            await expectRevert.unspecified(
                purchaseFor(this.contract, recipient, 'both', One, '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c', recipient)
            );
        });

        it('when purchaseId does not exist', async function () {
            await expectRevert.unspecified(
                purchaseFor(this.contract, recipient, 'invalid', One, this.erc20TokenAddress, recipient)
            );
        });

        it('when the value is inssuficient', async function () {
            const priceForOne = await getPrice(this.contract, 'both', One, this.erc20TokenAddress);

            await expectRevert.unspecified(
                purchaseFor(this.contract, recipient, 'both', Two, this.erc20TokenAddress, recipient, {
                    value: priceForOne
                })
            );
        });
    });

    const testPurchases = async function (operator, overvalue) {
        for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
            const quantities = [One, new BN('10'), new BN('1000')];
            for (const quantity of quantities) {
                it('<this.test.title>', async function () {
                    const priceForOne = (this.erc20TokenAddress == EthAddress) ? ethPrice : erc20Price;
                    const price = (new BN(priceForOne)).mul(quantity);

                    this.test.title = `purchasing ${quantity.toString()} * '${purchaseId}' for ${fromWei(price.toString())} ${this.erc20TokenAddress == EthAddress ? 'ETH' : 'ERC20'}`;

                    const priceFromContract = await getPrice(this.contract, purchaseId, quantity, this.erc20TokenAddress);
                    priceFromContract.should.be.bignumber.equal(price);

                    if (price.eq(Zero)) {
                        await expectRevert.unspecified(
                            purchaseFor(this.contract, recipient, purchaseId, quantity, this.erc20TokenAddress, operator)
                        );
                    } else {
                        const balanceBefore =
                            this.erc20TokenAddress == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.erc20TokenAddress, operator);

                        const receipt = await purchaseFor(this.contract, recipient, purchaseId, quantity, this.erc20TokenAddress, operator, {value: price.add(overvalue)});

                        expectEvent.inLogs(receipt.logs, 'Purchased', {
                            purchaseId: purchaseId,
                            paymentToken: toChecksumAddress(this.erc20TokenAddress),
                            price: priceForOne,
                            quantity: quantity,
                            recipient: recipient,
                            operator: operator,
                            extData: ''
                        });

                        const balanceAfter =
                            this.erc20TokenAddress == EthAddress ?
                                await balance.current(operator) :
                                await getBalance(this.erc20TokenAddress, operator);

                        const balanceDiff = balanceBefore.sub(balanceAfter);

                        if (this.erc20TokenAddress == EthAddress) {
                            const gasUsed = new BN(receipt.receipt.gasUsed);
                            balanceDiff.should.be.bignumber.equal(price.add(gasUsed));
                        } else {
                            balanceDiff.should.be.bignumber.equal(price);
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
                        recipient: recipient,
                        useErc20: useErc20,
                        setPrices: true});
                });
                await testPurchases(recipient, Zero);
            });
            describe('with overvalue (change)', async function () {
                before(async function () {
                    await doFreshDeploy.bind(this)({
                        payout: payout,
                        owner: owner,
                        operator: operator,
                        recipient: recipient,
                        useErc20: useErc20,
                        setPrices: true});
                });
                await testPurchases(recipient, ether('1'));
            });
        });

        describe('when buying via operator', async function () {
            describe('with exact amount', async function () {
                before(async function () {
                    await doFreshDeploy.bind(this)({
                        payout: payout,
                        owner: owner,
                        operator: operator,
                        recipient: recipient,
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
                        recipient: recipient,
                        useErc20: useErc20,
                        setPrices: true});
                });
                await testPurchases(operator, ether('1'));
            });
        });

    });

}

module.exports = simplePurchase;
