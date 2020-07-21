const { BN, ether, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, One } = require('@animoca/ethereum-contracts-core_library').constants;
const { shouldBeEqualWithPercentPrecision } = require('@animoca/ethereum-contracts-core_library').fixtures
const { toHex, padLeft, toBN } = require('web3-utils');

const KyberProxyAddress = '0xd3add19ee7e5287148a5866784aE3C55bd4E375A'; // Ganache snapshot
const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
const Erc20TokenAddress = '0x3750bE154260872270EbA56eEf89E78E6E21C1D9'; // OMG
const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const KyberPayment = artifacts.require('KyberPaymentMock');
const ERC20 = artifacts.require('ERC20Mock.sol');

function toBytes32(value) {
    return padLeft(toHex(value), 64);
}

contract('KyberPayment', function ([_, payout, owner, operator]) {
    beforeEach(async function () {
        this.contract = await KyberPayment.new(
            payout,
            PayoutTokenAddress,
            KyberProxyAddress,
            { from: owner });
    });

    describe('_setPayoutToken()', function () {
        it('should revert if the payout token is the zero address', async function () {
            await expectRevert(
                this.contract.callUnderscoreSetPayoutToken(
                    ZeroAddress,
                    { from: owner }),
                'KyberPayment: zero address payout token');
        });
    });

    describe('_handlePaymentTransfers()', function () {
        it('**********************************************************************************************', async function() { true.should.be.true; });
        it('*                                         TODO                                               *', async function() { true.should.be.true; });
        it('**********************************************************************************************', async function() { true.should.be.true; });
        /*
        const quantity = Constants.One;

        async function shouldRevert(recipient, tokenAddress, lotId, quantity, priceInfo, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                    recipient,
                    tokenAddress,
                    toBytes32(lotId),
                    quantity,
                    []);
            }

            const lot = await this.sale._lots(lotId);
            const payoutTotalPrice = lot.price.mul(quantity);

            const totalPrice = toBN(priceInfo[0]);
            const minConversionRate = toBN(priceInfo[1]);

            await expectRevert.unspecified(
                this.sale.callUnderscoreTransferFunds(
                    recipient,
                    tokenAddress,
                    sku,
                    quantity,
                    [
                        totalPrice,
                        minConversionRate,
                        extDataString
                    ].map(item => toBytes32(item)),
                    [
                        payoutTotalPrice
                    ].map(item => toBytes32(item)),
                    txParams));
        }

        async function shouldRevertWithValidatedQuantity(recipient, tokenAddress, lotId, quantity, priceInfo, txParams = {}) {
            const lot = await this.sale._lots(lotId);

            if (lot.exists) {
                (quantity.gt(Constants.Zero) && quantity.lte(lot.numAvailable)).should.be.true;
            }

            await shouldRevert.bind(this, recipient, tokenAddress, lotId, quantity, priceInfo, txParams)();
        }

        function testShouldRevertIfPurchasingForLessThanTheTotalPrice(recipient, lotId, quantity, tokenAddress) {
            it('should revert if purchasing for less than the total price', async function () {
                const priceInfo = await this.sale.callUnderscoreGetTotalPriceInfo(
                    recipient,
                    tokenAddress,
                    toBytes32(lotId),
                    quantity,
                    []);

                totalPrice = toBN(priceInfo[0]).divn(2);
                priceInfo[0] = toBytes32(totalPrice);

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
                const totalPrice = this.lot.price.mul(quantity);

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

                    const lot = await this.sale._lots(lotId);
                    this.payoutTotalPrice = lot.price.mul(quantity);
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
                                this.maxTokenAmount,
                                this.minConversionRate,
                                extDataString
                            ].map(item => toBytes32(item)),
                            [
                                this.payoutTotalPrice
                            ].map(item => toBytes32(item)),
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
                                this.totalPrice,
                                this.minConversionRate,
                                extDataString
                            ].map(item => toBytes32(item)),
                            [
                                this.payoutTotalPrice
                            ].map(item => toBytes32(item)),
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
                        this.payoutTotalPrice = this.lot.price.mul(quantity);
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
                                    this.maxTokenAmount,
                                    this.minConversionRate,
                                    extDataString
                                ].map(item => toBytes32(item)),
                                [
                                    this.payoutTotalPrice
                                ].map(item => toBytes32(item)),
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
                                    this.totalPrice,
                                    this.minConversionRate,
                                    extDataString
                                ].map(item => toBytes32(item)),
                                [
                                    this.payoutTotalPrice
                                ].map(item => toBytes32(item)),
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
                        this.payoutTotalPrice = this.lot.price.mul(quantity);
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
                                    this.maxTokenAmount,
                                    this.minConversionRate,
                                    extDataString
                                ].map(item => toBytes32(item)),
                                [
                                    this.payoutTotalPrice
                                ].map(item => toBytes32(item)),
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
                                    this.totalPrice,
                                    this.minConversionRate,
                                    extDataString
                                ].map(item => toBytes32(item)),
                                [
                                    this.payoutTotalPrice
                                ].map(item => toBytes32(item)),
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
        */
    });

    describe('_handlePaymentAmount()', function () {
        const quantity = One;
        const lotPrice = ether('0.00001'); // must be at least 0.00001

        function testShouldReturnCorrectPaymentAmountInfo(tokenAddress, maxDeviationPercentSignificand = null, maxDeviationPercentOrderOfMagnitude = 0) {
            beforeEach(async function () {
                const paymentAmountInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                    PayoutTokenAddress,
                    this.payoutAmount,
                    [
                        tokenAddress
                    ].map(item => toBytes32(item)));

                this.paymentAmount = toBN(paymentAmountInfo[0]);
                this.minConversionRate = toBN(paymentAmountInfo[1]);
            });

            it('should return correct total payment amount info', async function () {
                const expectedTotalPrice = this.payoutAmount;
                const actualTotalPrice = this.minConversionRate.mul(this.paymentAmount).div(new BN(10).pow(new BN(18)));

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
            this.payoutAmount = lotPrice.mul(quantity);
        });

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;
            testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress, 1, -7);  // max % dev: 0.0000001%
        });

        context('when the purchase token currency is an ERC20 token', function () {
            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;
                testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress);
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;
                testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress);
            });
        });
    });
});
