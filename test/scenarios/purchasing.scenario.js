const { BN } = require('@openzeppelin/test-helpers');
const { One } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32 } = require('../utils/bytes32');

const {
    shouldPurchaseFor,
    shouldRevertAndNotPurchaseFor
} = require('../behaviors');

const defaultUserData = stringToBytes32('userData');

const purchasingScenario = function (accounts, sku, userData, overrides = {}) {
    const [
        purchaser,
        recipient
    ] = accounts;

    if ((userData == null) || (userData == undefined)) {
        userData = defaultUserData;
    }

    if (!overrides.onlyErc20 && overrides.onlyEth) {
        describe('when purchasing with ETH', function () {

            describe('when purchasing for yourself', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not purchase for', async function () {
                        await shouldRevertAndNotPurchaseFor.bind(this)(
                            'Sale: insufficient ETH provided',
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            Object.assign(
                                { amountVariance: new BN(-1) },
                                overrides));
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            overrides);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            recipient,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            Object.assign(
                                { amountVariance: One },
                                overrides));
                    });

                });

            });

            describe('when purchasing for another', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not purchase for', async function () {
                        const estimate = await this.contract.estimatePurchase(
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            { from: purchaser });

                        await shouldRevertAndNotPurchaseFor.bind(this)(
                            'Sale: insufficient ETH provided',
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            Object.assign(
                                { amountVariance: new BN(-1) },
                                overrides));
                    });

                });

                describe('when the payment amount is sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            overrides);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            purchaser,
                            recipient,
                            this.ethTokenAddress,
                            sku,
                            One,
                            userData,
                            Object.assign(
                                { amountVariance: One },
                                overrides));
                    });

                });

            });

        });
    }

    if (!overrides.onlyEth && overrides.onlyErc20) {
        describe('when purchasing with ERC20', function () {

            describe('when purchasing for yourself', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not purchase for', async function () {
                        await shouldRevertAndNotPurchaseFor.bind(this)(
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

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            recipient,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
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

            describe('when purchasing for another', function () {

                describe('when the payment amount is insufficient', function () {

                    it('should revert and not purchase for', async function () {
                        await shouldRevertAndNotPurchaseFor.bind(this)(
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

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
                            purchaser,
                            recipient,
                            this.erc20TokenAddress,
                            sku,
                            One,
                            userData);
                    });

                });

                describe('when the payment amount is more than sufficient', function () {

                    it('should purchase for', async function () {
                        await shouldPurchaseFor.bind(this)(
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
    }

};

module.exports = {
    purchasingScenario
};
