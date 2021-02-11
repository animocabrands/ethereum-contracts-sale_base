const {artifacts, web3} = require('hardhat');
const {BN, ether, time, expectRevert} = require('@openzeppelin/test-helpers');
const {ZeroAddress, Zero, One, Two, Three, Four} = require('@animoca/ethereum-contracts-core_library').constants;
const {stringToBytes32} = require('../utils/bytes32');
const Fixture = require('@animoca/ethereum-contracts-core_library/test/utils/fixture');
const UniswapV2Fixture = require('../fixtures/uniswapv2.fixture');

const {purchasingScenario} = require('../scenarios');

const WETH9 = artifacts.require('WETH9');

const Sale = artifacts.require('UniswapOracleSaleMock');
const ERC20 = artifacts.require('ERC20Mock');

const skusCapacity = One;
const tokensPerSkuCapacity = Four;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;

let owner, payoutWallet, purchaser, recipient;

describe('UniswapOracleSale', function () {
  let loadFixture;

  before(async function () {
    let accounts = await web3.eth.getAccounts();

    loadFixture = Fixture.createFixtureLoader(accounts, web3.eth.currentProvider);

    [owner, payoutWallet, purchaser, recipient] = accounts;
  });

  // uniswapv2 fixture adds `contract` field to each token when it's loaded
  const tokens = {
    WETH: {
      abstraction: WETH9,
      supply: ether('1000'),
    },
    ReferenceToken: {
      abstraction: ERC20,
      supply: ether('1000'),
    },
    TokenA: {
      abstraction: ERC20,
      supply: ether('1000'),
    },
    TokenB: {
      abstraction: ERC20,
      supply: ether('1000'),
    },
    TokenC: {
      abstraction: ERC20,
      supply: ether('1000'),
    },
    TokenD: {
      abstraction: ERC20,
      supply: ether('1000'),
    },
  };

  const tokenPairs = {
    Pair1: ['WETH', 'ReferenceToken'],
    Pair2: ['TokenA', 'ReferenceToken'],
    Pair3: ['TokenB', 'ReferenceToken'],
    Pair4: ['TokenC', 'ReferenceToken'],
  };

  const liquidity = {
    ReferenceToken: {
      amount: new BN('1000000'),
      price: new BN('1000'),
    },
    TokenA: {
      amount: new BN('2000'),
      price: new BN('2'),
    },
    TokenB: {
      amount: new BN('3000000000'),
      price: new BN('3000000'),
    },
    TokenC: {
      amount: new BN('1000000'),
      price: new BN('1000'),
    },
  };

  async function doLoadFixture(params = {}) {
    const fixture = UniswapV2Fixture.get(params.tokens || tokens, params.tokenPairs || tokenPairs);

    this.fixtureData = await loadFixture(fixture);
  }

  async function doAddLiquidity(params = {}) {
    const timestamp = await time.latest();
    const deadline = params.deadline || timestamp.add(time.duration.minutes(5));

    const amountRefTokenMin = params.amountRefTokenMin || Zero;
    const amountTokenMin = params.amountTokenMin || Zero;
    const amountEthMin = params.amountEthMin || Zero;
    const router = this.fixtureData.router;

    const refTokenKey = 'ReferenceToken';
    const refTokenContract = tokens[refTokenKey].contract;
    const refLiquidityData = liquidity[refTokenKey];

    for (const [tokenPairKey, tokenPair] of Object.entries(tokenPairs)) {
      if (tokenPair.length !== 2) {
        throw new Error(`Invalid token pair length: ${tokenPairKey}`);
      }

      const refTokenIndex = tokenPair.indexOf(refTokenKey);

      if (refTokenIndex === -1) {
        throw new Error(`Missing expected reference token in pair: ${tokenPairKey}`);
      }

      const tokenIndex = refTokenIndex === 0 ? 1 : 0;
      const tokenKey = tokenPair[tokenIndex];

      await refTokenContract.approve(router.address, refLiquidityData.amount, {from: refLiquidityData.owner || owner});

      if (tokenKey === 'WETH') {
        await router.addLiquidityETH(
          refTokenContract.address,
          refLiquidityData.amount,
          amountRefTokenMin,
          amountEthMin,
          refLiquidityData.lpTokenRecipient || owner,
          deadline,
          {
            from: refLiquidityData.owner || owner,
            value: refLiquidityData.amount.mul(refLiquidityData.price),
          }
        );
      } else {
        const tokenContract = tokens[tokenKey].contract;
        const liquidityData = liquidity[tokenKey];

        await tokenContract.approve(router.address, liquidityData.amount, {from: liquidityData.owner || owner});

        await router.addLiquidity(
          tokenContract.address,
          refTokenContract.address,
          liquidityData.amount,
          refLiquidityData.amount,
          amountTokenMin,
          amountRefTokenMin,
          liquidityData.lpTokenRecipient || owner,
          deadline,
          {
            from: liquidityData.owner || owner,
          }
        );

        await tokenContract.approve(router.address, Zero, {from: liquidityData.owner || owner});
      }

      await refTokenContract.approve(router.address, Zero, {from: refLiquidityData.owner || owner});
    }
  }

  async function doDeploy(params = {}) {
    this.contract = await Sale.new(
      params.payoutWallet || payoutWallet,
      params.skusCapacity || skusCapacity,
      params.tokensPerSkuCapacity || tokensPerSkuCapacity,
      params.referenceToken || tokens['ReferenceToken'].contract.address,
      params.router || this.fixtureData.router.address,
      {from: params.owner || owner}
    );
  }

  async function doCreateSku(params = {}) {
    return await this.contract.createSku(
      params.sku || sku,
      params.skuTotalSupply || skuTotalSupply,
      params.skuMaxQuantityPerPurchase || skuMaxQuantityPerPurchase,
      params.skuNotificationsReceiver || skuNotificationsReceiver,
      {from: params.owner || owner}
    );
  }

  async function doUpdateSkuPricing(params = {}) {
    this.ethTokenAddress = await this.contract.TOKEN_ETH();
    this.oraclePrice = await this.contract.PRICE_CONVERT_VIA_ORACLE();

    const skuTokens = [
      tokens['ReferenceToken'].contract.address,
      this.ethTokenAddress,
      tokens['TokenA'].contract.address,
      tokens['TokenB'].contract.address,
    ];

    const tokenPrices = [
      liquidity['ReferenceToken'].price, // reference token
      this.oraclePrice, // ETH
      this.oraclePrice, // Token A
      this.oraclePrice,
    ]; // Token B

    return await this.contract.updateSkuPricing(params.sku || sku, params.tokens || skuTokens, params.prices || tokenPrices, {
      from: params.owner || owner,
    });
  }

  async function doStart(params = {}) {
    return await this.contract.start({from: params.owner || owner});
  }

  before(async function () {
    UniswapV2Fixture.reset();
  });

  beforeEach(async function () {
    await doLoadFixture.bind(this)();
  });

  describe('_conversionRate()', function () {
    const userData = stringToBytes32('userData');

    beforeEach(async function () {
      await doAddLiquidity.bind(this)();
      await doDeploy.bind(this)();
    });

    it('should revert if the source token to convert from is the zero address', async function () {
      await expectRevert(
        this.contract.callUnderscoreConversionRate(ZeroAddress, tokens['TokenA'].contract.address, userData),
        'UniswapV2Adapter: ZERO_ADDRESS'
      );
    });

    it('should revert if the destination token to convert to is the zero address', async function () {
      await expectRevert(
        this.contract.callUnderscoreConversionRate(tokens['TokenA'].contract.address, ZeroAddress, userData),
        'UniswapV2Adapter: ZERO_ADDRESS'
      );
    });

    it('should revert if the source and destination token are the same', async function () {
      await expectRevert(
        this.contract.callUnderscoreConversionRate(tokens['TokenA'].contract.address, tokens['TokenA'].contract.address, userData),
        'UniswapV2Adapter: IDENTICAL_ADDRESSES'
      );
    });

    it('should revert if the source token to convert from does not belong to a token pair', async function () {
      await expectRevert(
        this.contract.callUnderscoreConversionRate(tokens['TokenD'].contract.address, tokens['TokenA'].contract.address, userData),
        'revert'
      );
    });

    it('should revert if the destination token to convert to does not belong to a token pair', async function () {
      await expectRevert(
        this.contract.callUnderscoreConversionRate(tokens['TokenA'].contract.address, tokens['TokenD'].contract.address, userData),
        'revert'
      );
    });

    describe(`should return the correct conversion rates`, async function () {
      it('when the source token has a reserve less than the destination token', async function () {
        const fromToken = tokens['TokenA'].contract.address;
        const toToken = tokens['ReferenceToken'].contract.address;

        const actualRate = await this.contract.callUnderscoreConversionRate(fromToken, toToken, userData);

        const reserves = await this.contract.getReserves(fromToken, toToken);

        const expectedRate = reserves.reserveB.mul(new BN(10).pow(new BN(18))).div(reserves.reserveA);

        actualRate.should.be.bignumber.equal(expectedRate);
      });

      it('when the source token has a reserve more than the destination token', async function () {
        const fromToken = tokens['TokenB'].contract.address;
        const toToken = tokens['ReferenceToken'].contract.address;

        const actualRate = await this.contract.callUnderscoreConversionRate(fromToken, toToken, userData);

        const reserves = await this.contract.getReserves(fromToken, toToken);

        const expectedRate = reserves.reserveB.mul(new BN(10).pow(new BN(18))).div(reserves.reserveA);

        actualRate.should.be.bignumber.equal(expectedRate);
      });

      it('when the source token has a reserve equal to the destination token', async function () {
        const fromToken = tokens['TokenC'].contract.address;
        const toToken = tokens['ReferenceToken'].contract.address;

        const actualRate = await this.contract.callUnderscoreConversionRate(fromToken, toToken, userData);

        const reserves = await this.contract.getReserves(fromToken, toToken);

        const expectedRate = reserves.reserveB.mul(new BN(10).pow(new BN(18))).div(reserves.reserveA);

        actualRate.should.be.bignumber.equal(expectedRate);
      });

      it('when the source token is the ETH token', async function () {
        const fromToken = await this.contract.TOKEN_ETH();
        const toToken = tokens['ReferenceToken'].contract.address;

        const actualRate = await this.contract.callUnderscoreConversionRate(fromToken, toToken, userData);

        const reserves = await this.contract.getReserves(fromToken, toToken);

        const expectedRate = reserves.reserveB.mul(new BN(10).pow(new BN(18))).div(reserves.reserveA);

        actualRate.should.be.bignumber.equal(expectedRate);
      });
    });
  });

  describe('scenarios', function () {
    beforeEach(async function () {
      await doAddLiquidity.bind(this)();
      await doDeploy.bind(this)();
      await doCreateSku.bind(this)();
      await doUpdateSkuPricing.bind(this)();
      await doStart.bind(this)();
    });

    describe('purchasing', function () {
      beforeEach(async function () {
        this.erc20TokenAddress = tokens['TokenA'].contract.address;

        const erc20TokenContract = await ERC20.at(this.erc20TokenAddress);
        await erc20TokenContract.transfer(purchaser, ether('1'));
        await erc20TokenContract.transfer(recipient, ether('1'));

        this.purchaser = purchaser;
        this.recipient = recipient;
      });

      purchasingScenario(sku);
    });
  });
});
