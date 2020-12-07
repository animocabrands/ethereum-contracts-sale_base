const { ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two, Three } = require('@animoca/ethereum-contracts-core_library').constants;
const { addressToBytes32, stringToBytes32, uintToBytes32, bytes32ArraysToBytesPacked } = require('../utils/bytes32');

const Sale = artifacts.require('SaleMock.sol');
const ERC20 = artifacts.require('ERC20Mock.sol');
const PurchaseNotificationsReceiver = artifacts.require('PurchaseNotificationsReceiverMock');

const skusCapacity = Two;
const tokensPerSkuCapacity = Two;
const sku = stringToBytes32('sku');
const skuTotalSupply = Three;
const skuMaxQuantityPerPurchase = Two;
const skuNotificationsReceiver = ZeroAddress;
const erc20TotalSupply = ether('1000000000');
const purchaserErc20Balance = ether('100000');
const recipientErc20Balance = ether('100000')
const erc20Price = ether('1');
const ethPrice = ether('0.01');
const userData = '0x00';

contract('Sale', function ([_, owner, payoutWallet, purchaser, recipient]) {

    async function doDeploy(params = {}) {
        this.contract = await Sale.new(
            params.payoutWallet || payoutWallet,
            params.skusCapacity || skusCapacity,
            params.tokensPerSkuCapacity || tokensPerSkuCapacity,
            { from: params.owner || owner });
    }

    async function doCreateSku(params = {}) {
        return await this.contract.createSku(
            params.sku || sku,
            params.skuTotalSupply || skuTotalSupply,
            params.skuMaxQuantityPerPurchase || skuMaxQuantityPerPurchase,
            params.skuNotificationsReceiver || skuNotificationsReceiver,
            { from: params.owner || owner });
    }

    async function doUpdateSkuPricing(params = {}) {
        this.ethTokenAddress = await this.contract.TOKEN_ETH();

        if (params.useErc20) {
            this.erc20Token = await ERC20.new(
                params.erc20TotalSupply || erc20TotalSupply,
                { from: params.owner || owner });

            await this.erc20Token.transfer(
                params.purchaser || purchaser,
                params.purchaserErc20Balance || purchaserErc20Balance,
                { from: params.owner || owner });

            await this.erc20Token.transfer(
                params.recipient || recipient,
                params.recipientErc20Balance || recipientErc20Balance,
                { from: params.owner || owner });

            this.tokenAddress = this.erc20Token.address;
            this.tokenPrice = params.erc20Price || erc20Price;
        } else {
            this.tokenAddress = this.ethTokenAddress;
            this.tokenPrice = params.ethPrice || ethPrice;
        }

        return await this.contract.updateSkuPricing(
            params.sku || sku,
            [ this.tokenAddress ],
            [ this.tokenPrice ],
            { from: params.owner || owner });
    }

    async function doStart(params = {}) {
        return await this.contract.start({ from: params.owner || owner });
    };

    describe('start()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('reverts if called by any other than the contract owner', async function () {
            await expectRevert(
                doStart.bind(this)({ owner: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract has already started', async function () {
            await doStart.bind(this)();
            await expectRevert(
                doStart.bind(this)(),
                'Startable: started');
        });

        it('reverts if the contract is not paused', async function () {
            await this.contract.setPaused(false);
            await expectRevert(
                doStart.bind(this)(),
                'Pausable: not paused');

        });

        it('should start the contract', async function () {
            const startedAtBefore = await this.contract.startedAt();
            startedAtBefore.should.be.bignumber.equal(Zero);
            await doStart.bind(this)();
            const startedAtAfter = await this.contract.startedAt();
            startedAtAfter.should.be.bignumber.gt(Zero);
        });

        it('should unpause the contract', async function () {
            const pausedBefore = await this.contract.paused();
            pausedBefore.should.be.true;
            await doStart.bind(this)();
            const pausedAfter = await this.contract.paused();
            pausedAfter.should.be.false;
        });

    });

    describe('pause()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('reverts if called by any other than the contract owner', async function () {
            await expectRevert(
                this.contract.pause({ from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract has not been started yet', async function () {
            await expectRevert(
                this.contract.pause({ from: owner }),
                'Startable: not started');
        });

        it('reverts if the contract is already paused', async function () {
            await doStart.bind(this)();
            await this.contract.pause({ from: owner });
            await expectRevert(
                this.contract.pause({ from: owner }),
                'Pausable: paused');
        });

        it('should pause the contract', async function () {
            await doStart.bind(this)();
            const pausedBefore = await this.contract.paused();
            pausedBefore.should.be.false;
            await this.contract.pause({ from: owner });
            const pausedAfter = await this.contract.paused();
            pausedAfter.should.be.true;
        });

    });

    describe('unpause()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('reverts if called by any other than the contract owner', async function () {
            await doStart.bind(this)();
            await this.contract.pause({ from: owner });
            await expectRevert(
                this.contract.unpause({ from: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if the contract has not been started yet', async function () {
            await expectRevert(
                this.contract.unpause({ from: owner }),
                'Startable: not started');
        });

        it('reverts if the contract is not paused', async function () {
            await doStart.bind(this)();
            await expectRevert(
                this.contract.unpause({ from: owner }),
                'Pausable: not paused');
        });

        it('should resume the contract', async function () {
            await doStart.bind(this)();
            await this.contract.pause({ from: owner });
            const pausedBefore = await this.contract.paused();
            pausedBefore.should.be.true;
            await this.contract.unpause({ from: owner });
            const pausedAfter = await this.contract.paused();
            pausedAfter.should.be.false;
        });

    });

    describe('createSku()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('reverts if called by any other than the contract owner', async function () {
            await expectRevert(
                doCreateSku.bind(this)({ owner: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if `totalSupply` is zero', async function () {
            await expectRevert(
                doCreateSku.bind(this)({ skuTotalSupply: Zero }),
                'Sale: zero supply');
        });

        it('reverts if `sku` already exists', async function () {
            await doCreateSku.bind(this)();
            await expectRevert(
                doCreateSku.bind(this)(),
                'Sale: sku already created');
        });

        it('reverts if `notificationsReceiver` is not the zero address and is not a contract address', async function () {
            await expectRevert(
                doCreateSku.bind(this)({ skuNotificationsReceiver: purchaser }),
                'Sale: receiver is not a contract'
            )
        });

        it('reverts if the update results in too many SKUs', async function() {
            await doCreateSku.bind(this)();
            await doCreateSku.bind(this)({ sku: stringToBytes32('otherSku') })
            await expectRevert(
                doCreateSku.bind(this)({ sku: stringToBytes32('anotherSku') }),
                'Sale: too many skus');
        });

        it('should create a SKU', async function () {
            const skusBefore = await this.contract.getSkus();
            skusBefore.length.should.be.equal(0);

            await doCreateSku.bind(this)();

            const skusAfter = await this.contract.getSkus();
            skusAfter.length.should.be.equal(1);
            (skusAfter[0] === sku).should.be.true;

            const skuInfo = await this.contract.getSkuInfo(sku);
            skuInfo.totalSupply.should.be.bignumber.equal(skuTotalSupply);
            skuInfo.remainingSupply.should.be.bignumber.equal(skuTotalSupply);
            skuInfo.maxQuantityPerPurchase.should.be.bignumber.equal(skuMaxQuantityPerPurchase);
            skuInfo.notificationsReceiver.should.be.equal(ZeroAddress);
            skuInfo.tokens.length.should.equal(0);
            skuInfo.prices.length.should.equal(0);
        });

        it('should emit the SkuCreation event', async function () {
            const receipt = await doCreateSku.bind(this)();

            expectEvent(
                receipt,
                'SkuCreation',
                {
                    sku: sku,
                    totalSupply: skuTotalSupply,
                    maxQuantityPerPurchase: skuMaxQuantityPerPurchase,
                    notificationsReceiver: skuNotificationsReceiver
                });
        });

    });

    describe('updateSkuPricing()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('reverts if called by any other than the contract owner', async function () {
            await expectRevert(
                doUpdateSkuPricing.bind(this)({ owner: purchaser }),
                'Ownable: caller is not the owner');
        });

        it('reverts if `tokens` and `prices` have different lengths', async function () {
            const ethTokenAddress = await this.contract.TOKEN_ETH();

            await expectRevert(
                this.contract.updateSkuPricing(
                    sku,
                    [ ethTokenAddress ],
                    [],
                    { from: owner }),
                'Sale: tokens/prices lengths mismatch');
        });

        it('reverts if `sku` does not exist', async function () {
            await expectRevert(
                doUpdateSkuPricing.bind(this)({ sku: stringToBytes32('otherSku') }),
                'Sale: non-existent sku');
        });

        it('should disable a SKU if provided empty `tokens`/`prices` lists', async function () {
            await doUpdateSkuPricing.bind(this)();
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.tokens.length.should.equal(1);

            await this.contract.updateSkuPricing(sku, [], [], { from: owner });

            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.tokens.length.should.equal(0);
        });

        it('should update a SKU\'s set of supported token prices', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doUpdateSkuPricing.bind(this)({ useErc20: true });

            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.tokens.length.should.equal(2);
            skuInfoBefore.tokens[0].should.equal(this.ethTokenAddress);
            skuInfoBefore.prices[0].should.be.bignumber.equal(ethPrice);
            skuInfoBefore.tokens[1].should.be.equal(this.erc20Token.address);
            skuInfoBefore.prices[1].should.be.bignumber.equal(erc20Price);

            const erc20Token = await ERC20.new(erc20TotalSupply, { from: owner });
            const updatedErc20Price = erc20Price.muln(2);
            const newErc20Price = erc20Price.muln(3);
            await this.contract.updateSkuPricing(
                sku,
                [ this.ethTokenAddress, this.erc20Token.address, erc20Token.address ],
                [ Zero, updatedErc20Price, newErc20Price ],
                { from: owner });

            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.tokens.length.should.equal(2);
            skuInfoAfter.tokens[0].should.be.equal(this.erc20Token.address);
            skuInfoAfter.prices[0].should.be.bignumber.equal(updatedErc20Price);
            skuInfoAfter.tokens[1].should.be.equal(erc20Token.address);
            skuInfoAfter.prices[1].should.be.bignumber.equal(newErc20Price);
        });

        it('should emit the SkuPricingUpdate event', async function () {
            const receipt = await doUpdateSkuPricing.bind(this)();

            expectEvent(
                receipt,
                'SkuPricingUpdate',
                {
                    sku: sku,
                    tokens: [ this.ethTokenAddress ],
                    prices: [ ethPrice ]
                });
        });

    });

    describe('purchaseFor()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('reverts if the sale has not started', async function () {
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Startable: not started');
        });

        it('reverts if the sale is paused', async function () {
            await doStart.bind(this)();
            await this.contract.pause({ from: owner });
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Pausable: paused');
        });

        it('reverts if `recipient` is the zero address', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    ZeroAddress,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: zero address recipient');
        });

        it('reverts if `token` is the zero address', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    ZeroAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: zero address token');
        });

        it('reverts if `quantity` is zero', async function () {
            await doStart.bind(this)();
            const quantity = Zero;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: zero quantity purchase');
        });

        it('reverts if `sku` does not exist', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    stringToBytes32('otherSku'),
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: non-existent sku');
        });

        it('reverts if `quantity` is greater than the maximum purchase quantity', async function () {
            await doStart.bind(this)();
            const quantity = skuMaxQuantityPerPurchase.addn(1);
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: above max quantity');
        });

        it('reverts if `quantity` is greater than the remaining supply', async function () {
            await doStart.bind(this)();
            const quantity = skuMaxQuantityPerPurchase;
            await this.contract.purchaseFor(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData,
                {
                    from: purchaser,
                    value: ethPrice.mul(quantity)
                });
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    {
                        from: purchaser,
                        value: ethPrice.mul(quantity)
                    }),
                'Sale: insufficient supply');
        });

        it('reverts if `sku` exists but does not have a price set for `token`', async function () {
            const erc20Token = await ERC20.new(erc20TotalSupply, { from: owner });
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.purchaseFor(
                    recipient,
                    erc20Token.address,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: non-existent sku token');
        });

        it('should perform a purchase', async function () {
            await doStart.bind(this)();
            const quantity = One;
            const receipt = await this.contract.purchaseFor(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData,
                {
                    from: purchaser,
                    value: ethPrice.mul(quantity)
                });

            expectEvent(
                receipt,
                'Purchase',
                {
                    purchaser: purchaser,
                    recipient: recipient,
                    token: this.ethTokenAddress,
                    sku: sku,
                    quantity: One,
                    userData: userData,
                    totalPrice: this.tokenPrice.mul(One),
                    extData: bytes32ArraysToBytesPacked([[], [], []])
                });
        });

    });

    describe('estimatePurchase()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('reverts if the sale has not started', async function () {
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Startable: not started');
        });

        it('reverts if the sale is paused', async function () {
            await doStart.bind(this)();
            await this.contract.pause({ from: owner });
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Pausable: paused');
        });

        it('reverts if `recipient` is the zero address', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    ZeroAddress,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: zero address recipient');
        });

        it('reverts if `token` is the zero address', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    ZeroAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: zero address token');
        });

        it('reverts if `quantity` is zero', async function () {
            await doStart.bind(this)();
            const quantity = Zero;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: zero quantity purchase');
        });

        it('reverts if `sku` does not exist', async function () {
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    stringToBytes32('otherSku'),
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: non-existent sku');
        });

        it('reverts if `quantity` is greater than the maximum purchase quantity', async function () {
            await doStart.bind(this)();
            const quantity = skuMaxQuantityPerPurchase.addn(1);
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: above max quantity');
        });

        it('reverts if `quantity` is greater than the remaining supply', async function () {
            await doStart.bind(this)();
            const quantity = skuMaxQuantityPerPurchase;
            await this.contract.purchaseFor(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData,
                {
                    from: purchaser,
                    value: ethPrice.mul(quantity)
                });
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: insufficient supply');
        });

        it('reverts if `sku` exists but does not have a price set for `token`', async function () {
            const erc20Token = await ERC20.new(erc20TotalSupply, { from: owner });
            await doStart.bind(this)();
            const quantity = One;
            await expectRevert(
                this.contract.estimatePurchase(
                    recipient,
                    erc20Token.address,
                    sku,
                    quantity,
                    userData,
                    { from: purchaser }),
                'Sale: non-existent sku token');
        });

        it('should estimate the computed final total amount to pay', async function () {
            await doStart.bind(this)();
            const quantity = One;
            const priceInfo = await this.contract.estimatePurchase(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData,
                { from: purchaser });
            priceInfo.totalPrice.should.be.bignumber.equal(ethPrice.mul(quantity));
            priceInfo.pricingData.length.should.equal(0);
        });

    });

    describe('getSkuInfo()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('reverts if `sku` does not exist', async function () {
            await expectRevert(
                this.contract.getSkuInfo(
                    stringToBytes32('otherSku')),
                'Sale: non-existent sku');
        });

        it('should return the information relative to a SKU', async function () {
            const skuInfo = await this.contract.getSkuInfo(sku);
            skuInfo.totalSupply.should.be.bignumber.equal(skuTotalSupply);
            skuInfo.remainingSupply.should.be.bignumber.equal(skuTotalSupply);
            skuInfo.maxQuantityPerPurchase.should.be.bignumber.equal(skuMaxQuantityPerPurchase);
            skuInfo.notificationsReceiver.should.be.equal(skuNotificationsReceiver);
            skuInfo.tokens.length.should.be.equal(1);
            skuInfo.tokens[0].should.be.equal(this.ethTokenAddress);
            skuInfo.prices.length.should.be.equal(1);
            skuInfo.prices[0].should.be.bignumber.equal(ethPrice);
        });

    });

    describe('getSkus()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('should return the list of created SKU identifiers', async function () {
            const skus = await this.contract.getSkus();
            skus.length.should.be.equal(1);
            skus[0].should.be.equal(sku);
        });

    });

    describe('_setTokenPrices()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
        });

        it('reverts if one of the `tokens` is the zero address', async function () {
            await expectRevert(
                this.contract.setTokenPrices(
                    sku,
                    [ ZeroAddress ],
                    [ ethPrice ]),
                'Sale: zero address token');
        });

        it('reverts if the sku token price set exceeds the defined tokens per-sku capacity', async function () {
            const erc20Token1 = await ERC20.new(erc20TotalSupply, { from: owner });
            const erc20Token2 = await ERC20.new(erc20TotalSupply, { from: owner });
            const erc20Token3 = await ERC20.new(erc20TotalSupply, { from: owner });
            await expectRevert(
                this.contract.setTokenPrices(
                    sku,
                    [ erc20Token1.address, erc20Token2.address, erc20Token3.address ],
                    [ ethPrice, ethPrice, ethPrice ]),
                'Sale: too many tokens');
        });

        it('should disable a SKU token if provided a zero price', async function () {
            await doUpdateSkuPricing.bind(this)();
            await doUpdateSkuPricing.bind(this)({ useErc20: true });
            // await this.contract.getSkuInfo(sku);
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.tokens.length.should.equal(2);
            skuInfoBefore.prices.length.should.equal(2);
            await this.contract.setTokenPrices(
                sku,
                [ this.ethTokenAddress ],
                [ Zero ]);
            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.tokens.length.should.equal(1);
            skuInfoAfter.prices.length.should.equal(1);
            skuInfoAfter.tokens[0].should.equal(this.erc20Token.address);
            skuInfoAfter.prices[0].should.be.bignumber.equal(erc20Price);
        });

        it('should add support for a SKU token if provided a price for an unsupported token', async function () {
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.tokens.length.should.equal(0);
            skuInfoBefore.prices.length.should.equal(0);
            await this.contract.setTokenPrices(
                sku,
                [ this.ethTokenAddress ],
                [ ethPrice ]);
            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.tokens.length.should.equal(1);
            skuInfoAfter.prices.length.should.equal(1);
            skuInfoAfter.tokens[0].should.equal(this.ethTokenAddress);
            skuInfoAfter.prices[0].should.be.bignumber.equal(ethPrice);
        });

        it('should update a SKU token price', async function () {
            await doUpdateSkuPricing.bind(this)();
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.prices.length.should.equal(1);
            skuInfoBefore.prices[0].should.be.bignumber.equal(ethPrice);
            const updatedPrice = ethPrice.muln(2);
            await this.contract.setTokenPrices(
                sku,
                [ this.ethTokenAddress ],
                [ updatedPrice ]);
            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.prices.length.should.equal(1);
            skuInfoAfter.prices[0].should.be.bignumber.equal(updatedPrice);
        });

    });

    describe('_validation()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)();
            await doUpdateSkuPricing.bind(this)();
        });

        it('reverts if `purchase.recipient` is the zero address', async function () {
            await expectRevert(
                this.contract.validation(
                    ZeroAddress,
                    this.ethTokenAddress,
                    sku,
                    One,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: zero address recipient');
        });

        it('reverts if `purchase.token` is the zero address', async function () {
            await expectRevert(
                this.contract.validation(
                    recipient,
                    ZeroAddress,
                    sku,
                    One,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: zero address token');
        });

        it('reverts if `purchase.quantity` is zero', async function () {
            await expectRevert(
                this.contract.validation(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    Zero,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: zero quantity purchase');
        });

        it('reverts if `purchase.sku` does not exist', async function () {
            await expectRevert(
                this.contract.validation(
                    recipient,
                    this.ethTokenAddress,
                    stringToBytes32('otherSku'),
                    One,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: non-existent sku');
        });

        it('reverts if `purchase.quantity` is greater than the maximum purchase quantity', async function () {
            await expectRevert(
                this.contract.validation(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    skuMaxQuantityPerPurchase.addn(1),
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: above max quantity');
        });

        it('reverts if `purchase.quantity` is greater than the remaining supply', async function () {
            await doStart.bind(this)();
            const quantity = skuMaxQuantityPerPurchase;
            await this.contract.purchaseFor(
                recipient,
                this.ethTokenAddress,
                sku,
                quantity,
                userData,
                {
                    from: purchaser,
                    value: ethPrice.mul(quantity)
                });
            await expectRevert(
                this.contract.validation(
                    recipient,
                    this.ethTokenAddress,
                    sku,
                    quantity,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: insufficient supply');
        });

        it('reverts if `purchase.sku` exists but does not have a price set for `purchase.token`', async function () {
            const erc20Token = await ERC20.new(erc20TotalSupply, { from: owner });
            await expectRevert(
                this.contract.validation(
                    recipient,
                    erc20Token.address,
                    sku,
                    One,
                    userData,
                    Zero,
                    [],
                    [],
                    []),
                'Sale: non-existent sku token');
        });

    });

    describe('_delivery()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('should not update the SKU total supply if the supply is unlimited', async function () {
            const skuTotalSupply = await this.contract.SUPPLY_UNLIMITED();
            await doCreateSku.bind(this)({ skuTotalSupply: skuTotalSupply });
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.remainingSupply.should.be.bignumber.equal(skuTotalSupply);
            await this.contract.delivery(
                ZeroAddress,
                ZeroAddress,
                sku,
                One,
                userData,
                Zero,
                [],
                [],
                []);
            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.remainingSupply.should.be.bignumber.equal(skuTotalSupply);
        });

        it('should update the SKU total supply if the supply is limited', async function () {
            await doCreateSku.bind(this)();
            const skuInfoBefore = await this.contract.getSkuInfo(sku);
            skuInfoBefore.remainingSupply.should.be.bignumber.equal(skuTotalSupply);
            await this.contract.delivery(
                ZeroAddress,
                ZeroAddress,
                sku,
                One,
                userData,
                Zero,
                [],
                [],
                []);
            const skuInfoAfter = await this.contract.getSkuInfo(sku);
            skuInfoAfter.remainingSupply.should.be.bignumber.equal(skuTotalSupply.subn(1));
        });

    });

    describe('_notification()', function () {

        beforeEach(async function () {
            this.purchaseNotificationsReceiver = await PurchaseNotificationsReceiver.new();
            await doDeploy.bind(this)();
            await doCreateSku.bind(this)({ skuNotificationsReceiver: this.purchaseNotificationsReceiver.address });
            await doUpdateSkuPricing.bind(this)();
        });

        it('should emit the Purchase event', async function () {
            const pricingData = [stringToBytes32('abcde')];
            const paymentData = [];
            const deliveryData = [uintToBytes32(Two), addressToBytes32(this.ethTokenAddress)];

            const receipt = await this.contract.notification(
                recipient,
                this.ethTokenAddress,
                sku,
                One,
                userData,
                ethPrice,
                pricingData,
                paymentData,
                deliveryData,
                { from: purchaser });

            expectEvent(
                receipt,
                'Purchase',
                {
                    purchaser: purchaser,
                    recipient: recipient,
                    token: this.ethTokenAddress,
                    sku: sku,
                    quantity: One,
                    userData: userData,
                    totalPrice: ethPrice,
                    extData: bytes32ArraysToBytesPacked([
                        pricingData,
                        paymentData,
                        deliveryData
                    ])
                });
        });

        it('should call the SKU\'s notification receiver if defined', async function () {
            const receipt = await this.contract.notification(
                recipient,
                this.ethTokenAddress,
                sku,
                One,
                userData,
                ethPrice,
                [],
                [],
                [],
                { from: purchaser });

            await expectEvent.inTransaction(
                receipt.tx,
                this.purchaseNotificationsReceiver,
                'PurchaseNotificationReceived',
                {});
        });

    });

});
