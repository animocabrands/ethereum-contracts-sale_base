const {artifacts, web3} = require('hardhat');
const {BN, ether, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const {stringToBytes32} = require('../utils/bytes32');
const {ZeroAddress, EmptyByte, Zero, One, Two, Three} = require('@animoca/ethereum-contracts-core_library').constants;
const {makeNonFungibleTokenId} = require('@animoca/blockchain-inventory_metadata').inventoryIds;

const {purchasingScenario} = require('../scenarios');

const Sale = artifacts.require('FixedOrderInventorySaleMock.sol');
const Inventory = artifacts.require('AssetsInventoryMock.sol');
const Erc20 = artifacts.require('ERC20Mock.sol');

const erc20TotalSupply = ether('1000000000');
const purchaserErc20Balance = ether('100000');
const recipientErc20Balance = ether('100000');
const erc20Price = ether('1');

const nfMaskLength = 32;
const token1 = makeNonFungibleTokenId(1, 1, nfMaskLength);
const token2 = makeNonFungibleTokenId(2, 1, nfMaskLength);
const token3 = makeNonFungibleTokenId(3, 1, nfMaskLength);
const tokens = [token1, token2, token3];

const tokensPerSkuCapacity = Two;
const sku = stringToBytes32('sku');
const maxQuantityPerPurchase = Three;
const notificationsReceiver = ZeroAddress;

const userData = EmptyByte;

let deployer, payoutWallet, purchaser, recipient, other;

describe('FixedOrderInventorySale', function () {
  before(async function () {
    [deployer, payoutWallet, purchaser, recipient, other] = await web3.eth.getAccounts();
  });

  async function doDeployErc20(overrides = {}) {
    this.erc20 = await Erc20.new(overrides.erc20TotalSupply || erc20TotalSupply, {from: overrides.from || deployer});

    await this.erc20.transfer(overrides.purchaser || purchaser, overrides.purchaserErc20Balance || purchaserErc20Balance, {
      from: overrides.from || deployer,
    });

    await this.erc20.transfer(overrides.recipient || recipient, overrides.recipientErc20Balance || recipientErc20Balance, {
      from: overrides.from || deployer,
    });
  }

  async function doDeployInventory(overrides = {}) {
    this.inventory = await Inventory.new(overrides.nfMaskLength || nfMaskLength, {from: overrides.from || deployer});

    this.tokens = overrides.tokens || tokens;
  }

  async function doDeploySale(overrides = {}) {
    this.sale = await Sale.new(
      overrides.inventory || this.inventory.address,
      overrides.payoutWallet || payoutWallet,
      overrides.tokensPerSkuCapacity || tokensPerSkuCapacity,
      {from: overrides.from || deployer}
    );
  }

  async function doAddSupply(overrides = {}) {
    await this.sale.addSupply(overrides.tokens || tokens, {from: overrides.from || deployer});
  }

  async function doCreateSku(overrides = {}) {
    await this.sale.methods['createSku(bytes32,uint256,address)'](
      overrides.sku || sku,
      overrides.maxQuantityPerPurchase || maxQuantityPerPurchase,
      overrides.notificationReceiver || notificationsReceiver,
      {from: overrides.from || deployer}
    );
  }

  async function doUpdateSkuPricing(overrides = {}) {
    await this.sale.updateSkuPricing(overrides.sku || sku, [overrides.erc20Address || this.erc20.address], [overrides.erc20Price || erc20Price], {
      from: overrides.from || deployer,
    });
  }

  describe('constructor', function () {
    beforeEach(async function () {
      await doDeployInventory.bind(this)();
    });

    describe('when `inventory_` is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(doDeploySale.bind(this)({inventory: ZeroAddress}), 'FixedOrderInventorySale: zero address inventory');
      });
    });

    describe('when successful', function () {
      beforeEach(async function () {
        await doDeploySale.bind(this)();
      });

      it('supports a single sale SKU', async function () {
        const skuCapacity = await this.sale.getSkuCapacity();
        skuCapacity.should.be.bignumber.equal(One);
      });

      it('sets the inventory contract correctly', async function () {
        const inventory = await this.sale.inventory();
        inventory.should.be.equal(this.inventory.address);
      });

      it('sets the tokens per-sku capacity correctly', async function () {
        const capacity = await this.sale.getTokensPerSkuCapacity();
        capacity.should.be.bignumber.equal(tokensPerSkuCapacity);
      });
    });
  });

  describe('addSupply()', function () {
    const token4 = makeNonFungibleTokenId(4, 1, nfMaskLength);
    const token5 = makeNonFungibleTokenId(5, 1, nfMaskLength);
    const tokens = [token4, token5];

    beforeEach(async function () {
      await doDeployInventory.bind(this)();
      await doDeploySale.bind(this)();
    });

    describe('when called by any other than the contract owner', function () {
      it('reverts', async function () {
        await expectRevert(this.sale.addSupply(tokens, {from: other}), 'Ownable: caller is not the owner');
      });
    });

    describe('when `tokens` is empty', function () {
      it('reverts', async function () {
        await expectRevert(this.sale.addSupply([], {from: deployer}), 'FixedOrderInventorySale: empty tokens to add');
      });
    });

    describe('when any of `tokens` are zero', function () {
      it('reverts', async function () {
        await expectRevert(this.sale.addSupply([token4, Zero, token5], {from: deployer}), 'FixedOrderInventorySale: adding zero token');
      });
    });

    describe('when successful', function () {
      const addSupply = () => {
        beforeEach(async function () {
          this.tokenList = await this.sale.getTokenList();

          await this.sale.addSupply(tokens, {from: deployer});
        });

        it('appends the tokens to the sale supply correctly', async function () {
          const tokenList = await this.sale.getTokenList();
          this.tokenList.push(...tokens.map((token) => new BN(token)));
          this.tokenList.length.should.equal(tokenList.length);

          for (var index = 0; index < this.tokenList.length; ++index) {
            tokenList[index].toString().should.equal(this.tokenList[index].toString());
          }
        });
      };

      context('when the SKU for the sale inventory has not been created yet', function () {
        addSupply();
      });

      context('when the SKU for the sale inventory has been created', function () {
        beforeEach(async function () {
          await doAddSupply.bind(this)();
          await doCreateSku.bind(this)();
          this.skuInfo = await this.sale.getSkuInfo(sku);
        });

        addSupply();

        it('updates the sku total supply correctly', async function () {
          const skuInfo = await this.sale.getSkuInfo(sku);
          skuInfo.totalSupply.should.be.bignumber.equal(this.skuInfo.totalSupply.addn(tokens.length));
        });

        it('updates the sku remaining supply correctly', async function () {
          const skuInfo = await this.sale.getSkuInfo(sku);
          skuInfo.remainingSupply.should.be.bignumber.equal(this.skuInfo.remainingSupply.addn(tokens.length));
        });
      });
    });
  });

  describe('setSupply()', function () {
    beforeEach(async function () {
      await doDeployInventory.bind(this)();
      await doDeploySale.bind(this)();
    });

    context('when called by any other than the contract owner', function () {
      it('reverts', async function () {
        await expectRevert(this.sale.setSupply([0], [token2], {from: other}), 'Ownable: caller is not the owner');
      });
    });

    context('when the contract is not paused', function () {
      it('reverts', async function () {
        await this.sale.start({from: deployer});

        await expectRevert(this.sale.setSupply([0], [token2], {from: deployer}), 'Pausable: not paused');
      });
    });

    context('when the token list is empty', function () {
      it('reverts', async function () {
        await expectRevert(this.sale.setSupply([0], [token2], {from: deployer}), 'FixedOrderInventorySale: empty token list');
      });
    });

    context('when the token list is initialized', function () {
      beforeEach(async function () {
        await doAddSupply.bind(this)();
      });

      describe('when the lengths of `indexes` and `tokens` do not match', function () {
        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([0], [token2, token3], {from: deployer}), 'FixedOrderInventorySale: array length mismatch');
        });
      });

      describe('when `indexes` is zero length', function () {
        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([], [token2], {from: deployer}), 'FixedOrderInventorySale: empty indexes');
        });
      });

      describe('when any of the indexes are less than the token index', function () {
        beforeEach(async function () {
          await doDeployErc20.bind(this)();
          await doCreateSku.bind(this)();
          await doUpdateSkuPricing.bind(this)();

          await this.sale.start({from: deployer});

          const quantity = One;

          await this.erc20.approve(this.sale.address, quantity.mul(erc20Price), {from: purchaser});

          await this.sale.purchaseFor(recipient, this.erc20.address, sku, quantity, userData, {from: purchaser});

          await this.sale.pause({from: deployer});
        });

        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([0], [token2], {from: deployer}), 'FixedOrderInventorySale: invalid index');
        });
      });

      describe('when any of `indexes` are out-of-bounds', function () {
        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([tokens.length], [token2], {from: deployer}), 'FixedOrderInventorySale: index out-of-bounds');
        });
      });

      describe('when `tokens` is zero length', function () {
        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([0], [], {from: deployer}), 'FixedOrderInventorySale: array length mismatch');
        });
      });

      describe('when any of `tokens` are zero', function () {
        it('reverts', async function () {
          await expectRevert(this.sale.setSupply([0, 1, 2], [token2, Zero, token1], {from: deployer}), 'FixedOrderInventorySale: zero token');
        });
      });

      describe('when successful', function () {
        beforeEach(async function () {
          this.tokenList = await this.sale.getTokenList();
          this.tokens = new Array(this.tokenList.length);
          const indexes = new Array(this.tokenList.length);

          for (var index = 0; index < this.tokenList.length; index++) {
            var i = (index + 1) % this.tokenList.length;
            this.tokens[i] = this.tokenList[index];
            indexes[index] = index;
          }

          await this.sale.setSupply(indexes, this.tokens, {from: deployer});
        });

        it('should set the supply correctly', async function () {
          const tokenList = await this.sale.getTokenList();
          tokenList.length.should.equal(this.tokens.length);

          for (var index = 0; index < tokenList.length; index++) {
            tokenList[index].should.be.bignumber.equal(this.tokens[index]);
          }
        });
      });
    });
  });

  describe('getTotalSupply()', function () {
    const token4 = makeNonFungibleTokenId(4, 1, nfMaskLength);
    const token5 = makeNonFungibleTokenId(5, 1, nfMaskLength);
    const addedTokens = [token4, token5];

    beforeEach(async function () {
      await doDeployInventory.bind(this)();
      await doDeploySale.bind(this)();
    });

    context('when there is no initial sale supply', function () {
      context('when the sku has not been created', function () {
        context('when additional supply is not added', function () {
          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(Zero);
          });
        });

        context('when additional supply is added', function () {
          beforeEach(async function () {
            await doAddSupply.bind(this)({tokens: addedTokens});
          });

          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(new BN(addedTokens.length));
          });
        });
      });
    });

    context('when there is an initial sale supply', function () {
      beforeEach(async function () {
        await doAddSupply.bind(this)();
      });

      context('when the sku has not been created', function () {
        context('when additional supply is not added', function () {
          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(new BN(tokens.length));
          });
        });

        context('when additional supply is added', function () {
          beforeEach(async function () {
            await doAddSupply.bind(this)({tokens: addedTokens});
          });

          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(new BN(tokens.length + addedTokens.length));
          });
        });
      });

      context('when the sku has been created', function () {
        beforeEach(async function () {
          await doCreateSku.bind(this)();
        });

        context('when additional supply is not added', function () {
          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(new BN(tokens.length));
            const skuInfo = await this.sale.getSkuInfo(sku);
            totalSupply.should.be.bignumber.equal(skuInfo.totalSupply);
          });
        });

        context('when additional supply is added', function () {
          beforeEach(async function () {
            await doAddSupply.bind(this)({tokens: addedTokens});
          });

          it('retrieves the correct total supply', async function () {
            const totalSupply = await this.sale.getTotalSupply();
            totalSupply.should.be.bignumber.equal(new BN(tokens.length + addedTokens.length));
            const skuInfo = await this.sale.getSkuInfo(sku);
            totalSupply.should.be.bignumber.equal(skuInfo.totalSupply);
          });
        });
      });
    });
  });

  describe('_delivery()', function () {
    beforeEach(async function () {
      await doDeployErc20.bind(this)();
      await doDeployInventory.bind(this)();
      await doDeploySale.bind(this)();
      await doAddSupply.bind(this)();
      await doCreateSku.bind(this)();
      await doUpdateSkuPricing.bind(this)();
    });

    describe('when successful', function () {
      const quantity = Two;

      beforeEach(async function () {
        this.tokenList = await this.sale.getTokenList();
        this.tokenIndex = await this.sale.tokenIndex();

        this.receipt = await this.sale.underscoreDelivery(recipient, this.erc20.address, sku, quantity, userData, quantity.mul(erc20Price), [], [], {
          from: purchaser,
        });
      });

      it('updates the token index correctly', async function () {
        const tokenIndex = await this.sale.tokenIndex();
        tokenIndex.should.be.bignumber.equal(this.tokenIndex.add(quantity));
      });

      it('updates the purchase delivery data correctly', async function () {
        var tokens = [];
        var index = this.tokenIndex.toNumber();

        for (var count = 0; count < quantity.toNumber(); count++) {
          tokens.push('0x' + this.tokenList[index++].toString(16));
        }

        expectEvent(this.receipt, 'DeliveryData', {
          tokens: tokens,
        });
      });
    });
  });

  describe('scenarios', function () {
    beforeEach(async function () {
      await doDeployErc20.bind(this)();
      await doDeployInventory.bind(this)();
      await doDeploySale.bind(this)();
      await doAddSupply.bind(this)();
      await doCreateSku.bind(this)();
      await doUpdateSkuPricing.bind(this)();
      await this.sale.start({from: deployer});
    });

    describe('purchasing', function () {
      beforeEach(async function () {
        await this.erc20.transfer(purchaser, ether('1'));
        await this.erc20.transfer(recipient, ether('1'));
        this.contract = this.sale;
        this.erc20TokenAddress = this.erc20.address;
        this.purchaser = purchaser;
        this.recipient = recipient;
      });

      purchasingScenario(sku, userData, {onlyErc20: true});
    });
  });
});
