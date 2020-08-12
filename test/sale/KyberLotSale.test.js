const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const InventoryIds = require('@animoca/blockchain-inventory_metadata').inventoryIds;
const Constants = require('@animoca/ethereum-contracts-core_library').constants;
const { shouldBeEqualWithPercentPrecision } = require('@animoca/ethereum-contracts-core_library').fixtures
const { toBN } = require('web3-utils');

const { stringToBytes32, uintToBytes32 } = require('../utils/bytes32');

const IERC20 = artifacts.require('IERC20');
const AssetsInventory = artifacts.require('AssetsInventoryMock');
const Sale = artifacts.require('KyberLotSaleMock');

contract('KyberLotSale', function ([
    _,
    payoutWallet,
    owner,
    operator,
    recipient,
    ...accounts
]) {
    const NF_MASK_LENGTH = 32;

    const nfTokenId1 = InventoryIds.makeNonFungibleTokenId(1, 1, NF_MASK_LENGTH);
    const nfTokenId2 = InventoryIds.makeNonFungibleTokenId(2, 1, NF_MASK_LENGTH);
    const nfTokenId3 = InventoryIds.makeNonFungibleTokenId(3, 1, NF_MASK_LENGTH);
    const ftCollectionId = InventoryIds.makeFungibleCollectionId(1);

    const KyberProxyAddress = '0xd3add19ee7e5287148a5866784aE3C55bd4E375A'; // Ganache snapshot
    const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
    const Erc20TokenAddress = '0x3750bE154260872270EbA56eEf89E78E6E21C1D9'; // OMG
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const lotId = Constants.Zero;
    const lotFungibleAmount = new BN('100');
    const lotPrice = ether('0.00001'); // must be at least 0.00001

    const sku = uintToBytes32(lotId);
    const extDataString = 'extData';

    const unknownLotId = Constants.One;

    beforeEach(async function () {
        this.inventory = await AssetsInventory.new(NF_MASK_LENGTH, { from: owner });

        const sale = await Sale.new(
            KyberProxyAddress,
            payoutWallet,
            PayoutTokenAddress,
            ftCollectionId,
            this.inventory.address,
            { from: owner });

        await sale.createLot(
            lotId,
            [ nfTokenId1, nfTokenId2, nfTokenId3 ],
            lotFungibleAmount,
            { from: owner });

        await sale.addSupportedPaymentTokens(
            [ PayoutTokenAddress ],
            { from: owner });

        await sale.setSkuTokenPrices(
            sku,
            [ PayoutTokenAddress ],
            [ lotPrice ],
            { from: owner });

        this.sale = sale;
    });

    describe('_calculatePrice()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);

            const priceInfo = await this.sale.callUnderscoreCalculatePrice(
                recipient,
                tokenAddress,
                sku,
                quantity,
                [], // extData
                { from: operator });

            this.totalPrice = toBN(priceInfo[0]);
        });

        it('should return correct total price pricing info', async function () {
            const expectedUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
            const expectedTotalPrice = expectedUnitPrice.mul(quantity);
            const actualTotalPrice = this.totalPrice;
            expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
        });
    });

    describe('_transferFunds()', function () {
        const quantity = Constants.One;

        async function shouldRevert(recipient, tokenAddress, lotId, quantity, priceInfo, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                    recipient,
                    tokenAddress,
                    uintToBytes32(lotId),
                    quantity,
                    []);
            }

            const sku = uintToBytes32(lotId);
            const payoutUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
            const payoutTotalPrice = payoutUnitPrice.mul(quantity);

            const totalPrice = toBN(priceInfo[0]);
            const minConversionRate = toBN(priceInfo[1]);

            await expectRevert.unspecified(
                this.sale.callUnderscoreTransferFunds(
                    recipient,
                    tokenAddress,
                    sku,
                    quantity,
                    [
                        uintToBytes32(totalPrice),
                        uintToBytes32(minConversionRate),
                        stringToBytes32(extDataString)
                    ],
                    [ uintToBytes32(payoutTotalPrice) ],
                    txParams));
        }

        async function shouldRevertWithValidatedQuantity(recipient, tokenAddress, lotId, quantity, priceInfo, txParams = {}) {
            const sku = uintToBytes32(lotId);
            const exists = await this.sale.hasInventorySku(sku);

            if (exists) {
                const lot = await this.sale._lots(lotId);
                (quantity.gt(Constants.Zero) && quantity.lte(lot.numAvailable)).should.be.true;
            }

            await shouldRevert.bind(this, recipient, tokenAddress, lotId, quantity, priceInfo, txParams)();
        }

        function testShouldRevertIfPurchasingForLessThanTheTotalPrice(recipient, lotId, quantity, tokenAddress) {
            it('should revert if purchasing for less than the total price', async function () {
                const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                    recipient,
                    tokenAddress,
                    uintToBytes32(lotId),
                    quantity,
                    []);

                totalPrice = toBN(priceInfo[0]).divn(2);
                priceInfo[0] = uintToBytes32(totalPrice);

                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    recipient,
                    tokenAddress,
                    lotId,
                    quantity,
                    priceInfo,
                    { from: operator })();
            });
        }

        function testShouldRevertPurchaseTokenTransferFrom(lotId, quantity, tokenAddress, tokenBalance) {
            context('when the sale contract has a sufficient purchase allowance from the operator', function () {
                beforeEach(async function () {
                    await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                });

                afterEach(async function () {
                    await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                });

                it('should revert if the operator has an insufficient purchase balance', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        tokenAddress,
                        lotId,
                        quantity,
                        null,
                        { from: operator })();
                });
            });

            context('when the operator has a sufficient purchase balance', function () {
                beforeEach(async function () {
                    await this.erc20.transfer(operator, tokenBalance, { from: recipient });
                });

                afterEach(async function () {
                    const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                    await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                });

                it('should revert if the sale contract has an insufficient purchase allowance from the operator', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        tokenAddress,
                        lotId,
                        quantity,
                        null,
                        { from: operator })();
                });
            });
        }

        function testShouldTransferPayoutTokens(quantity) {
            it('should transfer payout tokens from the sale contract to the payout wallet', async function () {
                const unitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
                const totalPrice = unitPrice.mul(quantity);

                await expectEvent.inTransaction(
                    this.receipt.tx,
                    this.erc20Payout,
                    'Transfer',
                    {
                        _from: this.sale.address,
                        _to: payoutWallet,
                        _value: totalPrice
                    });

                const payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);
                payoutWalletTokenBalance.should.be.bignumber.equal(
                    this.payoutWalletTokenBalance.add(totalPrice));
            });
        }

        function testShouldReturnCorrectTransferFundsInfo(paymentToken) {
            it('should return correct tokens sent accepted payment info', async function () {
                if (paymentToken == EthAddress) {
                    const paymentWalletTokenBalance = await balance.current(operator);
                    const gasUsed = this.receipt.receipt.gasUsed;
                    const gasPrice = await web3.eth.getGasPrice();
                    const gasCost = new BN(gasPrice).muln(gasUsed);
                    const tokensSent = this.paymentWalletTokenBalance.sub(paymentWalletTokenBalance).sub(gasCost);
                    toBN(this.result.paymentInfo[0]).should.be.bignumber.equal(tokensSent);
                } else {
                    const paymentWalletTokenBalance = await this.erc20.balanceOf(operator);
                    const tokensSent = this.paymentWalletTokenBalance.sub(paymentWalletTokenBalance);
                    toBN(this.result.paymentInfo[0]).should.be.bignumber.equal(tokensSent);
                }
            });

            it('should return correct tokens received accepted payment info', async function () {
                const payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);
                const tokensReceived = payoutWalletTokenBalance.sub(this.payoutWalletTokenBalance);
                toBN(this.result.paymentInfo[1]).should.be.bignumber.equal(tokensReceived);
            });
        }

        beforeEach(async function () {
            this.erc20Payout = await IERC20.at(PayoutTokenAddress);
        });

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;

            it('should revert if the transaction contains an insufficient amount of ETH', async function () {
                await shouldRevertWithValidatedQuantity.bind(
                    this,
                    recipient,
                    tokenAddress,
                    lotId,
                    quantity,
                    null,
                    {
                        from: operator,
                        value: Constants.Zero
                    })();
            });

            testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                this,
                recipient,
                lotId,
                quantity,
                tokenAddress)();

            context('when sucessfully making a purchase', function () {
                beforeEach(async function () {
                    this.buyerEthBalance = await balance.current(operator);

                    this.paymentWalletTokenBalance = this.buyerEthBalance;
                    this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                    this.lot = await this.sale._lots(lotId);
                    (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                    const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                        recipient,
                        tokenAddress,
                        sku,
                        quantity,
                        []);

                    this.totalPrice = toBN(priceInfo[0]);
                    this.minConversionRate = toBN(priceInfo[1]);

                    const payoutUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
                    this.payoutTotalPrice = payoutUnitPrice.mul(quantity);
                });

                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        this.maxTokenAmount = this.totalPrice.muln(2);

                        this.receipt = await this.sale.callUnderscoreTransferFunds(
                            recipient,
                            tokenAddress,
                            sku,
                            quantity,
                            [
                                uintToBytes32(this.maxTokenAmount),
                                uintToBytes32(this.minConversionRate),
                                stringToBytes32(extDataString)
                            ],
                            [ uintToBytes32(this.payoutTotalPrice) ],
                            {
                                from: operator,
                                value: this.maxTokenAmount
                            });

                        const transferFundsEvents = await this.sale.getPastEvents(
                            'UnderscoreTransferFundsResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.result = transferFundsEvents[0].args;
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.totalPrice);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        quantity)();

                    testShouldReturnCorrectTransferFundsInfo.bind(
                        this,
                        tokenAddress)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        this.receipt = await this.sale.callUnderscoreTransferFunds(
                            recipient,
                            tokenAddress,
                            sku,
                            quantity,
                            [
                                uintToBytes32(this.totalPrice),
                                uintToBytes32(this.minConversionRate),
                                stringToBytes32(extDataString)
                            ],
                            [ uintToBytes32(this.payoutTotalPrice) ],
                            {
                                from: operator,
                                value: this.totalPrice
                            });

                        const transferFundsEvents = await this.sale.getPastEvents(
                            'UnderscoreTransferFundsResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.result = transferFundsEvents[0].args;
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.totalPrice);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        quantity)();

                    testShouldReturnCorrectTransferFundsInfo.bind(
                        this,
                        tokenAddress)();
                });
            });
        });

        context('when the purchase token currency is an ERC20 token', function () {
            const tokenBalance = ether(Constants.One);

            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                beforeEach(async function () {
                    this.erc20 = await IERC20.at(tokenAddress);
                });

                it('should revert if the transaction contains any ETH', async function () {
                    await shouldRevertWithValidatedQuantity.bind(
                        this,
                        recipient,
                        tokenAddress,
                        lotId,
                        quantity,
                        null,
                        {
                            from: operator,
                            value: Constants.One
                        })();
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress)();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);

                        this.paymentWalletTokenBalance = this.buyerPurchaseTokenBalance;
                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        this.lot = await this.sale._lots(lotId);
                        (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                        const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                            recipient,
                            tokenAddress,
                            sku,
                            quantity,
                            []);

                        this.totalPrice = toBN(priceInfo[0]);
                        this.minConversionRate = toBN(priceInfo[1]);

                        const payoutUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
                        this.payoutTotalPrice = payoutUnitPrice.mul(quantity);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.totalPrice.muln(2);

                            this.receipt = await this.sale.callUnderscoreTransferFunds(
                                recipient,
                                tokenAddress,
                                sku,
                                quantity,
                                [
                                    uintToBytes32(this.maxTokenAmount),
                                    uintToBytes32(this.minConversionRate),
                                    stringToBytes32(extDataString)
                                ],
                                [ uintToBytes32(this.payoutTotalPrice) ],
                                { from: operator });

                            const transferFundsEvents = await this.sale.getPastEvents(
                                'UnderscoreTransferFundsResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = transferFundsEvents[0].args;
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.sale.address,
                                    // // unable to get an exact value due to the
                                    // // dynamic nature of the conversion rate,
                                    // // but it should be almost the purchase
                                    // // amount with a deviation of up to 5% in
                                    // // general.
                                    // _value: this.maxTokenAmount
                                });

                            const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                            const buyerPurchaseTokenBalanceDelta = this.buyerPurchaseTokenBalance.sub(buyerPurchaseTokenBalance);

                            shouldBeEqualWithPercentPrecision(
                                buyerPurchaseTokenBalanceDelta,
                                this.totalPrice,
                                5); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.maxTokenAmount));
                        });

                        it('should transfer purchase tokens change from the sale contract to the operator', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: this.sale.address,
                                    _to: operator,
                                    // // unable to get an exact value due to the
                                    // // dynamic nature of the conversion rate,
                                    // // but it should be almost the difference
                                    // // between the purchase amount and the
                                    // // total price with a deviation of up to 5%
                                    // // in general.
                                    // _value: this.maxTokenAmount.sub(this.totalPrice)
                                });
                        });

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();

                        testShouldReturnCorrectTransferFundsInfo.bind(
                            this,
                            tokenAddress)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscoreTransferFunds(
                                recipient,
                                tokenAddress,
                                sku,
                                quantity,
                                [
                                    uintToBytes32(this.totalPrice),
                                    uintToBytes32(this.minConversionRate),
                                    stringToBytes32(extDataString)
                                ],
                                [ uintToBytes32(this.payoutTotalPrice) ],
                                { from: operator });

                            const transferFundsEvents = await this.sale.getPastEvents(
                                'UnderscoreTransferFundsResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = transferFundsEvents[0].args;
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.sale.address,
                                    _value: this.totalPrice
                                });

                            const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                            const buyerPurchaseTokenBalanceDelta = this.buyerPurchaseTokenBalance.sub(buyerPurchaseTokenBalance);

                            shouldBeEqualWithPercentPrecision(
                                buyerPurchaseTokenBalanceDelta,
                                this.totalPrice,
                                5); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.totalPrice));
                        });

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();

                        testShouldReturnCorrectTransferFundsInfo.bind(
                            this,
                            tokenAddress)();
                    });
                });
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                function testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken() {
                    it('should transfer purchase tokens from the operator to the sale contract', async function () {
                        await expectEvent.inTransaction(
                            this.receipt.tx,
                            this.erc20,
                            'Transfer',
                            {
                                _from: operator,
                                _to: this.sale.address,
                                _value: this.totalPrice
                            });

                        const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                        buyerPurchaseTokenBalance.should.be.bignumber.equal(
                            this.buyerPurchaseTokenBalance.sub(this.totalPrice));

                        const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);
                        spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                            this.spenderPurchaseTokenAllowance.sub(this.totalPrice));
                    });
                }

                beforeEach(async function () {
                    this.erc20 = await IERC20.at(tokenAddress);
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    lotId,
                    quantity,
                    tokenAddress)();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    lotId,
                    quantity,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.sale.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.sale.address);

                        this.paymentWalletTokenBalance = this.buyerPurchaseTokenBalance;
                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        this.lot = await this.sale._lots(lotId);
                        (quantity.gt(Constants.Zero) && quantity.lte(this.lot.numAvailable)).should.be.true;

                        const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                            recipient,
                            tokenAddress,
                            sku,
                            quantity,
                            []);

                        this.totalPrice = toBN(priceInfo[0]);
                        this.minConversionRate = toBN(priceInfo[1]);

                        const payoutUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
                        this.payoutTotalPrice = payoutUnitPrice.mul(quantity);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.sale.address, Constants.Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.totalPrice.muln(2);

                            this.receipt = await this.sale.callUnderscoreTransferFunds(
                                recipient,
                                tokenAddress,
                                sku,
                                quantity,
                                [
                                    uintToBytes32(this.maxTokenAmount),
                                    uintToBytes32(this.minConversionRate),
                                    stringToBytes32(extDataString)
                                ],
                                [ uintToBytes32(this.payoutTotalPrice) ],
                                { from: operator });

                            const transferFundsEvents = await this.sale.getPastEvents(
                                'UnderscoreTransferFundsResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = transferFundsEvents[0].args;
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();

                        testShouldReturnCorrectTransferFundsInfo.bind(
                            this,
                            tokenAddress)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.sale.callUnderscoreTransferFunds(
                                recipient,
                                tokenAddress,
                                sku,
                                quantity,
                                [
                                    uintToBytes32(this.totalPrice),
                                    uintToBytes32(this.minConversionRate),
                                    stringToBytes32(extDataString)
                                ],
                                [ uintToBytes32(this.payoutTotalPrice) ],
                                { from: operator });

                            const transferFundsEvents = await this.sale.getPastEvents(
                                'UnderscoreTransferFundsResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = transferFundsEvents[0].args;
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            quantity)();

                        testShouldReturnCorrectTransferFundsInfo.bind(
                            this,
                            tokenAddress)();
                    });
                });
            });
        });
    });

    describe('_getTotalPriceInfo()', function () {
        const quantity = Constants.One;
        const tokenAddress = EthAddress;

        function testShouldReturnCorrectPurchasePricingInfo(recipient, tokenAddress, maxDeviationPercentSignificand = null, maxDeviationPercentOrderOfMagnitude = 0) {
            beforeEach(async function () {
                const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                    recipient,
                    tokenAddress,
                    sku,
                    quantity,
                    []);

                this.totalPrice = toBN(priceInfo[0]);
                this.minConversionRate = toBN(priceInfo[1]);
            });

            it('should return correct total price pricing info', async function () {
                const expectedUnitPrice = await this.sale.getSkuTokenPrice(sku, PayoutTokenAddress);
                const expectedTotalPrice = expectedUnitPrice.mul(quantity);
                const actualTotalPrice = this.minConversionRate.mul(this.totalPrice).div(new BN(10).pow(new BN(18)));

                if (maxDeviationPercentSignificand) {
                    shouldBeEqualWithPercentPrecision(
                        actualTotalPrice,
                        expectedTotalPrice,
                        maxDeviationPercentSignificand,
                        maxDeviationPercentOrderOfMagnitude);
                } else {
                    expectedTotalPrice.should.be.bignumber.equal(actualTotalPrice);
                }
            });
        }

        beforeEach(async function () {
            this.lot = await this.sale._lots(lotId);
        });

        // it('should revert if the lot doesnt exist', async function () {
        //     await expectRevert(
        //         this.sale.callUnderscoreGetTotalPriceInfo(
        //             recipient,
        //             tokenAddress,
        //             uintToBytes32(unknownLotId),
        //             quantity,
        //             []),
        //         'KyberLotSale: non-existent lot');
        // });

        // it('should revert if the token address is the zero-address', async function () {
        //     await expectRevert(
        //         this.sale.callUnderscoreGetTotalPriceInfo(
        //             recipient,
        //             Constants.ZeroAddress,
        //             sku,
        //             quantity,
        //             []),
        //         'zero address payment token');
        // });

        context('when the purchase token currency is ETH', function () {
            testShouldReturnCorrectPurchasePricingInfo.bind(
                this,
                recipient,
                tokenAddress,
                1,
                -7)();  // max % dev: 0.0000001%
        });

        context('when the purchase token currency is an ERC20 token', function () {
            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                testShouldReturnCorrectPurchasePricingInfo.bind(
                    this,
                    recipient,
                    tokenAddress)();
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;

                testShouldReturnCorrectPurchasePricingInfo.bind(
                    this,
                    recipient,
                    tokenAddress)();
            });
        });
    });
});
