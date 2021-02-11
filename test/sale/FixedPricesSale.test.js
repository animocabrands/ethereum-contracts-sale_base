const {artifacts, web3} = require('hardhat');
const {BN, balance, ether, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const {ZeroAddress, Zero, One, Two} = require('@animoca/ethereum-contracts-core_library').constants;

const {stringToBytes32} = require('../utils/bytes32');

const Sale = artifacts.require('FixedPricesSaleMock');
const ERC20 = artifacts.require('ERC20Mock');
const IERC20 = artifacts.require('@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol:IERC20');

const sku = stringToBytes32('sku');
const skuTotalSupply = Two;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;
const ethPrice = ether('0.01');
const erc20Price = ether('1');
const userData = stringToBytes32('userData');

const skusCapacity = One;
const tokensPerSkuCapacity = One;

const erc20TotalSupply = ether('1000000000');
const purchaserErc20Balance = ether('100000');
const recipientErc20Balance = ether('100000');

let _, payoutWallet, owner, purchaser, recipient;

describe('FixedPricesSale', function () {
  before(async function () {
    [_, payoutWallet, owner, purchaser, recipient] = await web3.eth.getAccounts();
  });

  async function doFreshDeploy(params) {
    this.contract = await Sale.new(
      params.payoutWallet || payoutWallet,
      params.skusCapacity || skusCapacity,
      params.tokensPerSkuCapacity || tokensPerSkuCapacity,
      {from: params.owner || owner}
    );

    await this.contract.createSku(
      params.sku || sku,
      params.skuTotalSupply || skuTotalSupply,
      params.skuMaxQuantityPerPurchase || skuMaxQuantityPerPurchase,
      params.skuNotificationsReceiver || skuNotificationsReceiver,
      {from: params.owner || owner}
    );

    this.ethTokenAddress = await this.contract.TOKEN_ETH();

    if (params.useErc20) {
      this.erc20Token = await ERC20.new(params.erc20TotalSupply || erc20TotalSupply, {from: params.owner || owner});

      await this.erc20Token.transfer(params.purchaser || purchaser, params.purchaserErc20Balance || purchaserErc20Balance, {
        from: params.owner || owner,
      });

      await this.erc20Token.transfer(params.recipient || recipient, params.recipientErc20Balance || recipientErc20Balance, {
        from: params.owner || owner,
      });

      this.tokenAddress = this.erc20Token.address;
      this.tokenPrice = params.erc20Price || erc20Price;
    } else {
      this.tokenAddress = this.ethTokenAddress;
      this.tokenPrice = params.ethPrice || ethPrice;
    }

    await this.contract.updateSkuPricing(params.sku || sku, [this.tokenAddress], [this.tokenPrice], {from: owner});

    await this.contract.start({from: params.owner || owner});
  }

  describe('Purchase', function () {
    function purchase(useErc20) {
      async function purchaseFor(purchase, overrides) {
        const estimatePurchase = await this.contract.estimatePurchase(
          purchase.recipient,
          purchase.token,
          purchase.sku,
          purchase.quantity,
          purchase.userData,
          {from: purchase.purchaser}
        );

        let amount = estimatePurchase.totalPrice;

        if (overrides) {
          if (overrides.amount !== undefined) {
            amount = overrides.amount;
          }
        }

        let etherValue;

        if (purchase.token === this.ethTokenAddress) {
          etherValue = amount;
        } else {
          const ERC20Contract = await IERC20.at(purchase.token);
          // approve first for sale
          await ERC20Contract.approve(this.contract.address, amount, {from: purchase.purchaser});
          // do not send any ether
          etherValue = 0;
        }

        return this.contract.purchaseFor(purchase.recipient, purchase.token, purchase.sku, purchase.quantity, purchase.userData, {
          from: purchase.purchaser,
          value: etherValue,
          gasPrice: 1,
        });
      }

      async function getBalance(token, address) {
        const contract = await ERC20.at(token);
        return await contract.balanceOf(address);
      }

      function testPurchases(quantities, overvalue) {
        for (const quantity of quantities) {
          it('<this.test.title>', async function () {
            const operator = this.operator;

            const estimate = await this.contract.estimatePurchase(recipient, this.tokenAddress, sku, quantity, userData, {from: operator});

            const totalPrice = estimate.totalPrice;

            this.test.title = `purchasing ${quantity.toString()} items for ${web3.utils.fromWei(totalPrice.toString())} ${
              this.token == this.ethTokenAddress ? 'ETH' : 'ERC20'
            }`;

            const balanceBefore =
              this.tokenAddress == this.ethTokenAddress ? await balance.current(operator) : await getBalance(this.tokenAddress, operator);

            const receipt = await purchaseFor.bind(this)(
              {
                purchaser: operator,
                recipient: recipient,
                token: this.tokenAddress,
                sku: sku,
                quantity: quantity,
                userData: userData,
              },
              {
                amount: totalPrice.add(overvalue),
              }
            );

            expectEvent(receipt, 'Purchase', {
              purchaser: operator,
              recipient: recipient,
              token: web3.utils.toChecksumAddress(this.tokenAddress),
              sku: sku,
              quantity: quantity,
              userData: userData,
              totalPrice: totalPrice,
            });

            const balanceAfter =
              this.tokenAddress == this.ethTokenAddress ? await balance.current(operator) : await getBalance(this.tokenAddress, operator);

            const balanceDiff = balanceBefore.sub(balanceAfter);

            if (this.tokenAddress == this.ethTokenAddress) {
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
          await doFreshDeploy.bind(this)({useErc20: useErc20});
        });

        it('when the payment amount is insufficient', async function () {
          const estimate = await this.contract.estimatePurchase(recipient, this.tokenAddress, sku, One, userData, {from: purchaser});

          const unitPrice = estimate.totalPrice;

          await expectRevert(
            purchaseFor.bind(this)(
              {
                purchaser: purchaser,
                recipient: recipient,
                token: this.tokenAddress,
                sku: sku,
                quantity: Two,
                userData: userData,
              },
              {amount: unitPrice}
            ),
            useErc20 ? 'ERC20: transfer amount exceeds allowance' : 'Sale: insufficient ETH provided'
          );
        });
      });

      describe('should emit a Purchase event and update balances', function () {
        const quantities = [One, new BN('10'), new BN('1000')];

        const skuTotalSupply = quantities.reduce((sum, value) => {
          return sum.add(value);
        });

        const skuMaxQuantityPerPurchase = quantities.reduce((max, value) => {
          return BN.max(max, value);
        });

        describe('when buying for oneself', function () {
          describe('with exact amount', function () {
            before(async function () {
              await doFreshDeploy.bind(this)({
                skuTotalSupply: skuTotalSupply,
                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                useErc20: useErc20,
              });

              this.operator = purchaser;
            });

            testPurchases(quantities, Zero);
          });

          describe('with overvalue (change)', function () {
            before(async function () {
              await doFreshDeploy.bind(this)({
                skuTotalSupply: skuTotalSupply,
                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                useErc20: useErc20,
              });

              this.operator = purchaser;
            });

            testPurchases(quantities, ether('1'));
          });
        });

        describe('when buying via operator', function () {
          describe('with exact amount', function () {
            before(async function () {
              await doFreshDeploy.bind(this)({
                skuTotalSupply: skuTotalSupply,
                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                useErc20: useErc20,
              });

              this.operator = recipient;
            });

            testPurchases(quantities, Zero);
          });

          describe('with overvalue (change)', function () {
            before(async function () {
              await doFreshDeploy.bind(this)({
                skuTotalSupply: skuTotalSupply,
                skuMaxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                useErc20: useErc20,
              });

              this.operator = recipient;
            });

            testPurchases(quantities, ether('1'));
          });
        });
      });
    }

    describe('purchase with ether', function () {
      purchase(false);
    });

    describe('purchase with ERC20', function () {
      purchase(true);
    });
  });
});
