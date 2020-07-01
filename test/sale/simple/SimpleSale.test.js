const { BN, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { asciiToHex } = require('web3-utils');
const { ZeroAddress } = require('@animoca/ethereum-contracts-core_library').constants;

const simplePurchase = require('./behaviours/SimplePurchase.behaviour');
const { doFreshDeploy, prices } = require('./shared');

contract('SimpleSale', function ([_, payout, owner, operator, purchaser]) {
    describe('Purchase IDs Management', function () {
        describe('setPayoutToken', function () {
            const newPayoutToken = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c';

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
                await expectRevert.unspecified(
                    this.contract.setPayoutToken(newPayoutToken, { from: purchaser })
                );
            });

            it('should update the ERC20 payout token used by the contract', async function () {
                const initialPayoutToken = await this.contract.payoutToken();
                initialPayoutToken.should.not.equal(newPayoutToken);
                await this.contract.setPayoutToken(newPayoutToken, { from: owner });
                const updatedPayoutToken = await this.contract.payoutToken();
                updatedPayoutToken.should.equal(newPayoutToken);
            });
        });

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
                await expectRevert.unspecified(
                    this.contract.setPrice(sku, prices[purchaseId].ethPrice, prices[purchaseId].erc20Price, { from: purchaser })
                );
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
        describe('purchase with ether', async function () {
            simplePurchase(payout, owner, operator, purchaser, false);
        });

        describe('purchase with ERC20', async function () {
            simplePurchase(payout, owner, operator, purchaser, true);
        });
    });
});
