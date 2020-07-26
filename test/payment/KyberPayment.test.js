const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;
const { shouldBeEqualWithPercentPrecision } = require('@animoca/ethereum-contracts-core_library').fixtures
const { toHex, padLeft, toBN } = require('web3-utils');

const KyberPayment = artifacts.require('KyberPaymentMock');
const ERC20 = artifacts.require('ERC20Mock.sol');
const IERC20 = artifacts.require('IERC20.sol');

contract('KyberPayment', function ([_, payoutWallet, owner, operator, recipient]) {
    const KyberProxyAddress = '0xd3add19ee7e5287148a5866784aE3C55bd4E375A'; // Ganache snapshot
    const PayoutTokenAddress = '0xe19Ec968c15f487E96f631Ad9AA54fAE09A67C8c'; // MANA
    const Erc20TokenAddress = '0x3750bE154260872270EbA56eEf89E78E6E21C1D9'; // OMG
    const EthAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const payoutAmount = ether('1');

    function toBytes32(value) {
        return padLeft(toHex(value), 64);
    }

    beforeEach(async function () {
        this.contract = await KyberPayment.new(
            payoutWallet,
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
        async function shouldRevert(operator, paymentToken, payoutAmount, priceInfo, error, txParams = {}) {
            if (!priceInfo) {
                priceInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                    PayoutTokenAddress,
                    payoutAmount,
                    [ paymentToken ].map(item => toBytes32(item)));
            }

            const paymentAmount = toBN(priceInfo[0]);
            const minConversionRate = toBN(priceInfo[1]);

            if (error) {
                await expectRevert(
                    this.contract.callUnderscoreHandlePaymentTransfers(
                        operator,
                        paymentToken,
                        paymentAmount,
                        [
                            payoutAmount,
                            minConversionRate
                        ].map(item => toBytes32(item)),
                        txParams),
                    error);
            } else {
                await expectRevert.unspecified(
                    this.contract.callUnderscoreHandlePaymentTransfers(
                        operator,
                        paymentToken,
                        paymentAmount,
                        [
                            payoutAmount,
                            minConversionRate
                        ].map(item => toBytes32(item)),
                        txParams));
            }
        }

        function testShouldRevertIfPurchasingForLessThanTheTotalPrice(operator, paymentToken, payoutAmount, error) {
            it('should revert if purchasing for less than the total price', async function () {
                const priceInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                    PayoutTokenAddress,
                    payoutAmount,
                    [ paymentToken ].map(item => toBytes32(item)));

                const paymentAmount = toBN(priceInfo[0]).divn(2);
                priceInfo[0] = toBytes32(paymentAmount);

                await shouldRevert.bind(
                    this,
                    operator,
                    paymentToken,
                    payoutAmount,
                    priceInfo,
                    error,
                    { from: operator })();
            });
        }

        function testShouldRevertPurchaseTokenTransferFrom(tokenAddress, tokenBalance, error) {
            context('when the sale contract has a sufficient purchase allowance from the operator', function () {
                beforeEach(async function () {
                    await this.erc20.approve(this.contract.address, tokenBalance, { from: operator });
                });

                afterEach(async function () {
                    await this.erc20.approve(this.contract.address, Zero, { from: operator });
                });

                it('should revert if the operator has an insufficient purchase balance', async function () {
                    await shouldRevert.bind(
                        this,
                        recipient,
                        tokenAddress,
                        payoutAmount,
                        null,
                        error,
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
                    await shouldRevert.bind(
                        this,
                        recipient,
                        tokenAddress,
                        payoutAmount,
                        null,
                        '',
                        { from: operator })();
                });
            });
        }

        function testShouldTransferPayoutTokens(payoutAmount) {
            it('should transfer payout tokens from the sale contract to the payout wallet', async function () {
                await expectEvent.inTransaction(
                    this.receipt.tx,
                    this.erc20Payout,
                    'Transfer',
                    {
                        _from: this.contract.address,
                        _to: payoutWallet,
                        _value: payoutAmount
                    });

                const payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);
                payoutWalletTokenBalance.should.be.bignumber.equal(
                    this.payoutWalletTokenBalance.add(payoutAmount));
            });
        }

        function testShouldReturnCorrectHandlePaymentTransfersInfo(paymentToken) {
            it('should return correct tokens sent accepted payment info', async function () {
                if (paymentToken == EthAddress) {
                    const paymentWalletTokenBalance = await balance.current(operator);
                    const gasUsed = this.receipt.receipt.gasUsed;
                    const gasPrice = await web3.eth.getGasPrice();
                    const gasCost = new BN(gasPrice).muln(gasUsed);
                    const tokensSent = this.paymentWalletTokenBalance.sub(paymentWalletTokenBalance).sub(gasCost);
                    toBN(this.result.paymentTransfersInfo[0]).should.be.bignumber.equal(tokensSent);
                } else {
                    const paymentWalletTokenBalance = await this.erc20.balanceOf(operator);
                    const tokensSent = this.paymentWalletTokenBalance.sub(paymentWalletTokenBalance);
                    toBN(this.result.paymentTransfersInfo[0]).should.be.bignumber.equal(tokensSent);
                }
            });

            it('should return correct tokens received accepted payment info', async function () {
                const payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);
                const tokensReceived = payoutWalletTokenBalance.sub(this.payoutWalletTokenBalance);
                toBN(this.result.paymentTransfersInfo[1]).should.be.bignumber.equal(tokensReceived);
            });
        }

        beforeEach(async function () {
            this.erc20Payout = await IERC20.at(PayoutTokenAddress);
        });

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;

            it('should revert if the transaction contains an insufficient amount of ETH', async function () {
                await shouldRevert.bind(
                    this,
                    recipient,
                    tokenAddress,
                    payoutAmount,
                    null,
                    'KyberAdapter: insufficient ETH value',
                    {
                        from: operator,
                        value: Zero
                    })();
            });

            testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                this,
                recipient,
                tokenAddress,
                payoutAmount,
                'KyberAdapter: insufficient ETH value')();

            context('when sucessfully making a purchase', function () {
                beforeEach(async function () {
                    this.buyerEthBalance = await balance.current(operator);

                    this.paymentWalletTokenBalance = this.buyerEthBalance;
                    this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                    const priceInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                        PayoutTokenAddress,
                        payoutAmount,
                        [ tokenAddress ].map(item => toBytes32(item)));

                    this.paymentAmount = toBN(priceInfo[0]);
                    this.minConversionRate = toBN(priceInfo[1]);
                });

                context('when spending with more than the total price', function () {
                    beforeEach(async function () {
                        const paymentAmount = this.paymentAmount.muln(2);

                        this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                            operator,
                            tokenAddress,
                            paymentAmount,
                            [
                                payoutAmount,
                                this.minConversionRate
                            ].map(item => toBytes32(item)),
                            {
                                from: operator,
                                value: paymentAmount
                            });

                        const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                            'UnderscoreHandlePaymentTransfersResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.result = handlePaymentTransfersEvent[0].args;
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.paymentAmount);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        payoutAmount)();

                    testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
                        this,
                        tokenAddress)();
                });

                context('when spending the exact total price amount', function () {
                    beforeEach(async function () {
                        this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                            operator,
                            tokenAddress,
                            this.paymentAmount,
                            [
                                payoutAmount,
                                this.minConversionRate
                            ].map(item => toBytes32(item)),
                            {
                                from: operator,
                                value: this.paymentAmount
                            });

                        const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                            'UnderscoreHandlePaymentTransfersResult',
                            {
                                fromBlock: 0,
                                toBlock: 'latest'
                            });

                        this.result = handlePaymentTransfersEvent[0].args;
                    });

                    it('should transfer ETH to pay for the purchase', async function () {
                        const buyerEthBalance = await balance.current(operator);
                        const buyerEthBalanceDelta = this.buyerEthBalance.sub(buyerEthBalance);
                        buyerEthBalanceDelta.gte(this.paymentAmount);
                        // TODO: validate the correctness of the amount of
                        // ETH transferred to pay for the purchase
                    });

                    testShouldTransferPayoutTokens.bind(
                        this,
                        payoutAmount)();

                    testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
                        this,
                        tokenAddress)();
                });
            });
        });

        context('when the purchase token currency is an ERC20 token', function () {
            const tokenBalance = ether('10');

            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;

                beforeEach(async function () {
                    this.erc20 = await IERC20.at(tokenAddress);
                });

                it('should revert if the transaction contains any ETH', async function () {
                    await shouldRevert.bind(
                        this,
                        recipient,
                        tokenAddress,
                        payoutAmount,
                        null,
                        'KyberAdapter: unexpected ETH value',
                        {
                            from: operator,
                            value: One
                        })();
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    tokenAddress,
                    payoutAmount)();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.contract.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.contract.address);

                        this.paymentWalletTokenBalance = this.buyerPurchaseTokenBalance;
                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        const priceInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                            PayoutTokenAddress,
                            payoutAmount,
                            [ tokenAddress ].map(item => toBytes32(item)));

                        this.paymentAmount = toBN(priceInfo[0]);
                        this.minConversionRate = toBN(priceInfo[1]);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.contract.address, Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.paymentAmount.muln(2);

                            this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                                operator,
                                tokenAddress,
                                this.maxTokenAmount,
                                [
                                    payoutAmount,
                                    this.minConversionRate
                                ].map(item => toBytes32(item)),
                                { from: operator });

                            const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                                'UnderscoreHandlePaymentTransfersResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = handlePaymentTransfersEvent[0].args;
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.contract.address,
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
                                this.paymentAmount,
                                5); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.contract.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.maxTokenAmount));
                        });

                        it('should transfer purchase tokens change from the sale contract to the operator', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: this.contract.address,
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
                            payoutAmount)();

                        testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
                            this,
                            tokenAddress)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                                operator,
                                tokenAddress,
                                this.paymentAmount,
                                [
                                    payoutAmount,
                                    this.minConversionRate
                                ].map(item => toBytes32(item)),
                                { from: operator });

                            const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                                'UnderscoreHandlePaymentTransfersResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = handlePaymentTransfersEvent[0].args;
                        });

                        it('should transfer purchase tokens from the operator to the sale contract', async function () {
                            await expectEvent.inTransaction(
                                this.receipt.tx,
                                this.erc20,
                                'Transfer',
                                {
                                    _from: operator,
                                    _to: this.contract.address,
                                    _value: this.paymentAmount
                                });

                            const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                            const buyerPurchaseTokenBalanceDelta = this.buyerPurchaseTokenBalance.sub(buyerPurchaseTokenBalance);

                            shouldBeEqualWithPercentPrecision(
                                buyerPurchaseTokenBalanceDelta,
                                this.paymentAmount,
                                5); // max % dev: 5%

                            const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.contract.address);
                            spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                                this.spenderPurchaseTokenAllowance.sub(this.paymentAmount));
                        });

                        testShouldTransferPayoutTokens.bind(
                            this,
                            payoutAmount)();

                        testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
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
                                _to: this.contract.address,
                                _value: this.paymentAmount
                            });

                        const buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);
                        buyerPurchaseTokenBalance.should.be.bignumber.equal(
                            this.buyerPurchaseTokenBalance.sub(this.paymentAmount));

                        const spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.contract.address);
                        spenderPurchaseTokenAllowance.should.be.bignumber.equal(
                            this.spenderPurchaseTokenAllowance.sub(this.paymentAmount));
                    });
                }

                beforeEach(async function () {
                    this.erc20 = await IERC20.at(tokenAddress);
                });

                testShouldRevertIfPurchasingForLessThanTheTotalPrice.bind(
                    this,
                    recipient,
                    tokenAddress,
                    payoutAmount,
                    'KyberAdapter: insufficient source token amount')();

                testShouldRevertPurchaseTokenTransferFrom.bind(
                    this,
                    tokenAddress,
                    tokenBalance)();

                context('when sucessfully making a purchase', function () {
                    beforeEach(async function () {
                        await this.erc20.approve(this.contract.address, tokenBalance, { from: operator });
                        await this.erc20.transfer(operator, tokenBalance, { from: recipient });

                        this.buyerPurchaseTokenBalance = await this.erc20.balanceOf(operator);

                        this.spenderPurchaseTokenAllowance = await this.erc20.allowance(operator, this.contract.address);

                        this.paymentWalletTokenBalance = this.buyerPurchaseTokenBalance;
                        this.payoutWalletTokenBalance = await this.erc20Payout.balanceOf(payoutWallet);

                        const priceInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                            PayoutTokenAddress,
                            payoutAmount,
                            [ tokenAddress ].map(item => toBytes32(item)));

                        this.paymentAmount = toBN(priceInfo[0]);
                        this.minConversionRate = toBN(priceInfo[1]);
                    });

                    afterEach(async function () {
                        await this.erc20.approve(this.contract.address, Zero, { from: operator });
                        const tokenBalanceAfter = await this.erc20.balanceOf(operator);
                        await this.erc20.transfer(recipient, tokenBalanceAfter, { from: operator });
                    });

                    context('when spending with more than the total price', function () {
                        beforeEach(async function () {
                            this.maxTokenAmount = this.paymentAmount.muln(2);

                            this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                                operator,
                                tokenAddress,
                                this.maxTokenAmount,
                                [
                                    payoutAmount,
                                    this.minConversionRate
                                ].map(item => toBytes32(item)),
                                { from: operator });

                            const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                                'UnderscoreHandlePaymentTransfersResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = handlePaymentTransfersEvent[0].args;
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            payoutAmount)();

                        testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
                            this,
                            tokenAddress)();
                    });

                    context('when spending the exact total price amount', function () {
                        beforeEach(async function () {
                            this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                                operator,
                                tokenAddress,
                                this.paymentAmount,
                                [
                                    payoutAmount,
                                    this.minConversionRate
                                ].map(item => toBytes32(item)),
                                { from: operator });

                            const handlePaymentTransfersEvent = await this.contract.getPastEvents(
                                'UnderscoreHandlePaymentTransfersResult',
                                {
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });

                            this.result = handlePaymentTransfersEvent[0].args;
                        });

                        testShouldTransferPurchaseTokensToSaleContractWhenPayoutToken.bind(
                            this)();

                        testShouldTransferPayoutTokens.bind(
                            this,
                            payoutAmount)();

                        testShouldReturnCorrectHandlePaymentTransfersInfo.bind(
                            this,
                            tokenAddress)();
                    });
                });
            });
        });
    });

    describe('_handlePaymentAmount()', function () {
        function testShouldReturnCorrectPaymentAmountInfo(tokenAddress, maxDeviationPercentSignificand = null, maxDeviationPercentOrderOfMagnitude = 0) {
            beforeEach(async function () {
                const paymentAmountInfo = await this.contract.callUnderscoreHandlePaymentAmount(
                    PayoutTokenAddress,
                    payoutAmount,
                    [ tokenAddress ].map(item => toBytes32(item)));

                this.paymentAmount = toBN(paymentAmountInfo[0]);
                this.minConversionRate = toBN(paymentAmountInfo[1]);
            });

            it('should return correct total payment amount info', async function () {
                const expectedTotalPrice = payoutAmount;
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

        context('when the purchase token currency is ETH', function () {
            const tokenAddress = EthAddress;
            testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress, 1, -7);  // max % dev: 0.0000001%
        });

        context('when the purchase token currency is an ERC20 token', function () {
            context('when the purchase token currency is not the payout token currency', function () {
                const tokenAddress = Erc20TokenAddress;
                testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress, 1, -14);
            });

            context('when the purchase token currency is the payout token currency', function () {
                const tokenAddress = PayoutTokenAddress;
                testShouldReturnCorrectPaymentAmountInfo.bind(this)(tokenAddress);
            });
        });
    });
});
