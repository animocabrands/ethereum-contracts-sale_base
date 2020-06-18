const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress } = require('@animoca/ethereum-contracts-core_library').constants;

const simplePurchase = require('./behaviours/SimplePurchase.behaviour');
const { doFreshDeploy, prices } = require('./shared');

contract.only('SimpleSale', function ([_, payout, owner, operator, recipient]) {
    describe('setPayoutWallet', async function () {
        const newPayoutWallet = '0xB553C4B21966123d7f8c02Ca6909c110260052E8';

        beforeEach(async function () {
            await doFreshDeploy.bind(this)({
                payout: payout,
                owner: owner,
                operator: operator,
                recipient: recipient,
                useErc20: true,
                setPrices: false});
        });

        it('should fail if not sent by the owner', async function () {
            await expectRevert.unspecified(
                this.contract.setPayoutWallet(newPayoutWallet, { from: operator })
            );
        });

        it('should fail if setting to the zero address', async function () {
            await expectRevert.unspecified(
                this.contract.setPayoutWallet(ZeroAddress, { from: owner })
            );
        });

        it('should fail when wallet is sale contract itself', async function () {
            await expectRevert.unspecified(
                this.contract.setPayoutWallet(this.contract.address, { from: owner })
            )
        });

        it('should update the payout wallet', async function () {
            let payoutWallet = await this.contract.payoutWallet();
            payoutWallet.should.be.equal(payout);
            await this.contract.setPayoutWallet(newPayoutWallet, { from: owner });
            payoutWallet = await this.contract.payoutWallet();
            payoutWallet.should.be.equal(newPayoutWallet);
        });
    });

    describe('Purchase IDs Management', function () {
        describe('setErc20Token', function () {
            const newErc20Token = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c';

            beforeEach(async function () {
                await doFreshDeploy.bind(this)({
                    payout: payout,
                    owner: owner,
                    operator: operator,
                    recipient: recipient,
                    useErc20: true,
                    setPrices: false});
            });

            it('should fail if not sent by the owner', async function () {
                await expectRevert.unspecified(
                    this.contract.setErc20Token(newErc20Token, { from: recipient })
                );
            });

            it('should update the ERC20 payment token used by the contract', async function () {
                const initialErc20Token = await this.contract.erc20Token();
                initialErc20Token.should.not.equal(newErc20Token);
                await this.contract.setErc20Token(newErc20Token, { from: owner });
                const updatedErc20Token = await this.contract.erc20Token();
                updatedErc20Token.should.equal(newErc20Token);
            });
        });

        describe('setPrice()', function () {
            beforeEach(async function () {
                await doFreshDeploy.bind(this)({
                    payout: payout,
                    owner: owner,
                    operator: operator,
                    recipient: recipient,
                    useErc20: true,
                    setPrices: false});
            });

            it('should fail if not sent by the owner', async function () {
                await expectRevert.unspecified(
                    this.contract.setPrice('both', prices['both'].ethPrice, prices['both'].erc20Price, { from: recipient })
                );
            });

            it('should update the prices and emit a PriceUpdated event', async function () {
                for (const [purchaseId, {ethPrice, erc20Price}] of Object.entries(prices)) {
                    const initialPrices = await this.contract.prices(purchaseId);
                    initialPrices.ethPrice.should.be.bignumber.equal(new BN(0));
                    initialPrices.erc20Price.should.be.bignumber.equal(new BN(0));
                    await this.contract.setPrice(purchaseId, ethPrice, erc20Price, { from: owner });
                    const updatedPrices = await this.contract.prices(purchaseId);
                    updatedPrices.ethPrice.should.be.bignumber.equal(ethPrice);
                    updatedPrices.erc20Price.should.be.bignumber.equal(erc20Price);
                }

                for (const [purchaseId, {ethPrice, erc20Price}] of Object.entries(prices)) {

                    const { logs } = await this.contract.setPrice(purchaseId, ethPrice, erc20Price, { from: owner });

                    expectEvent.inLogs(logs, 'PriceUpdated', {
                        purchaseId: purchaseId,
                        ethPrice: ethPrice,
                        erc20Price: erc20Price
                    });
                }

                for (const purchaseId of Object.keys(prices)) {
                    const { logs } = await this.contract.setPrice(purchaseId, '0', '0', { from: owner });

                    expectEvent.inLogs(logs, 'PriceUpdated', {
                        purchaseId: purchaseId,
                        ethPrice: '0',
                        erc20Price: '0'
                    });
                }
            });
        });
    });

    describe('Purchasing', async function () {
        describe('purchase with ether', async function () {
            simplePurchase(payout, owner, operator, recipient, false);
        });

        describe('purchase with ERC20', async function () {
            simplePurchase(payout, owner, operator, recipient, true);
        });
    });
});
