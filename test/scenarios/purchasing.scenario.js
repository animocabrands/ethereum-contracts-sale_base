const {BN} = require('@openzeppelin/test-helpers');
const {One} = require('@animoca/ethereum-contracts-core_library').constants;
const {stringToBytes32} = require('../utils/bytes32');

const {shouldPurchaseFor, shouldRevertAndNotPurchaseFor} = require('../behaviors');

const defaultUserData = stringToBytes32('userData');

const purchasingScenario = function (sku, userData, overrides = {}) {
  if (userData == null || userData == undefined) {
    userData = defaultUserData;
  }

  if (!!overrides.onlyEth || !!!overrides.onlyErc20) {
    describe('when purchasing with ETH', function () {
      describe('when purchasing for yourself', function () {
        describe('when the payment amount is insufficient', function () {
          it('should revert and not purchase for', async function () {
            await shouldRevertAndNotPurchaseFor.bind(this)(
              'Sale: insufficient ETH provided',
              this.recipient,
              this.recipient,
              this.ethTokenAddress,
              sku,
              One,
              userData,
              Object.assign({amountVariance: new BN(-1)}, overrides)
            );
          });
        });

        describe('when the payment amount is sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.recipient, this.recipient, this.ethTokenAddress, sku, One, userData, overrides);
          });
        });

        describe('when the payment amount is more than sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(
              this.recipient,
              this.recipient,
              this.ethTokenAddress,
              sku,
              One,
              userData,
              Object.assign({amountVariance: One}, overrides)
            );
          });
        });
      });

      describe('when purchasing for another', function () {
        describe('when the payment amount is insufficient', function () {
          it('should revert and not purchase for', async function () {
            const estimate = await this.contract.estimatePurchase(this.recipient, this.ethTokenAddress, sku, One, userData, {from: this.purchaser});

            await shouldRevertAndNotPurchaseFor.bind(this)(
              'Sale: insufficient ETH provided',
              this.purchaser,
              this.recipient,
              this.ethTokenAddress,
              sku,
              One,
              userData,
              Object.assign({amountVariance: new BN(-1)}, overrides)
            );
          });
        });

        describe('when the payment amount is sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.purchaser, this.recipient, this.ethTokenAddress, sku, One, userData, overrides);
          });
        });

        describe('when the payment amount is more than sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(
              this.purchaser,
              this.recipient,
              this.ethTokenAddress,
              sku,
              One,
              userData,
              Object.assign({amountVariance: One}, overrides)
            );
          });
        });
      });
    });
  }

  if (!!overrides.onlyErc20 || !!!overrides.onlyEth) {
    describe('when purchasing with ERC20', function () {
      describe('when purchasing for yourself', function () {
        describe('when the payment amount is insufficient', function () {
          it('should revert and not purchase for', async function () {
            await shouldRevertAndNotPurchaseFor.bind(this)(
              'ERC20: transfer amount exceeds allowance',
              this.recipient,
              this.recipient,
              this.erc20TokenAddress,
              sku,
              One,
              userData,
              {
                amountVariance: new BN(-1),
              }
            );
          });
        });

        describe('when the payment amount is sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.recipient, this.recipient, this.erc20TokenAddress, sku, One, userData);
          });
        });

        describe('when the payment amount is more than sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.recipient, this.recipient, this.erc20TokenAddress, sku, One, userData, {
              amountVariance: One,
            });
          });
        });
      });

      describe('when purchasing for another', function () {
        describe('when the payment amount is insufficient', function () {
          it('should revert and not purchase for', async function () {
            await shouldRevertAndNotPurchaseFor.bind(this)(
              'ERC20: transfer amount exceeds allowance',
              this.purchaser,
              this.recipient,
              this.erc20TokenAddress,
              sku,
              One,
              userData,
              {
                amountVariance: new BN(-1),
              }
            );
          });
        });

        describe('when the payment amount is sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.purchaser, this.recipient, this.erc20TokenAddress, sku, One, userData);
          });
        });

        describe('when the payment amount is more than sufficient', function () {
          it('should purchase for', async function () {
            await shouldPurchaseFor.bind(this)(this.purchaser, this.recipient, this.erc20TokenAddress, sku, One, userData, {
              amountVariance: One,
            });
          });
        });
      });
    });
  }
};

module.exports = {
  purchasingScenario,
};
