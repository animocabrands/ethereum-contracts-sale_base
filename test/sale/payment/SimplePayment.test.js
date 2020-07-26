const { BN, balance, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { EthAddress, ZeroAddress, Zero, One, Two } = require('@animoca/ethereum-contracts-core_library').constants;

const SimplePayment = artifacts.require('SimplePaymentMock');
const ERC20 = artifacts.require('ERC20Mock.sol');

contract('SimplePayment', function ([_, payout, owner, operator]) {
    async function doFreshDeploy(params) {
        let payoutToken;

        if (params.useErc20) {
            const erc20Token = await ERC20.new(ether('1000000000'), { from: params.owner });
            await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
            payoutToken = erc20Token.address;
            this.payoutToken = payoutToken;
        } else {
            payoutToken = ZeroAddress;
            this.payoutToken = EthAddress;
        }

        this.contract = await SimplePayment.new(params.payout, payoutToken, { from: params.owner });
    };

    describe('_handlePaymentTransfers', function () {
        context('when paying with ETH', function () {
            beforeEach(async function () {
                await doFreshDeploy.bind(this)({
                    payout: payout,
                    owner: owner,
                    operator: operator,
                    useErc20: false
                });
            });

            context('when the payment value is insufficient', function () {
                it('should revert', async function () {
                    await expectRevert(
                        this.contract.callUnderscoreHandlePaymentTransfers(
                            operator,
                            this.payoutToken,
                            One,
                            [],
                            {
                                from: operator,
                                value: Zero
                            }),
                        'SimplePayment: insufficient ETH provided');
                });
            });

            context('when the payment amount is exact', function () {
                beforeEach(async function() {
                    this.operatorBalance = await balance.current(operator);
                    this.payoutBalance = await balance.current(payout);

                    this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                        operator,
                        this.payoutToken,
                        One,
                        [],
                        {
                            from: operator,
                            value: One
                        });
                });

                it('should transfer payment', async function () {
                    const operatorBalance = await balance.current(operator);
                    const payoutBalance = await balance.current(payout);

                    const gasUsed = this.receipt.receipt.gasUsed;
                    const gasPrice = await web3.eth.getGasPrice();
                    const gasCost = new BN(gasPrice).muln(gasUsed);

                    const ethSent = this.operatorBalance.sub(operatorBalance).sub(gasCost);
                    const ethReceived = payoutBalance.sub(this.payoutBalance);

                    ethSent.should.be.bignumber.equal(One);
                    ethReceived.should.be.bignumber.equal(One);
                });
            });

            context('when the payment amount is excessive', function () {
                beforeEach(async function() {
                    this.operatorBalance = await balance.current(operator);
                    this.payoutBalance = await balance.current(payout);
                    this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                        operator,
                        this.payoutToken,
                        One,
                        [],
                        {
                            from: operator,
                            value: Two
                        });
                });

                it('should transfer payment', async function () {
                    const operatorBalance = await balance.current(operator);
                    const payoutBalance = await balance.current(payout);

                    const gasUsed = this.receipt.receipt.gasUsed;
                    const gasPrice = await web3.eth.getGasPrice();
                    const gasCost = new BN(gasPrice).muln(gasUsed);

                    const ethSent = this.operatorBalance.sub(operatorBalance).sub(gasCost);
                    const ethReceived = payoutBalance.sub(this.payoutBalance);

                    ethSent.should.be.bignumber.equal(One);
                    ethReceived.should.be.bignumber.equal(One);
                });
            });
        });

        context('when paying with ERC20', function () {
            beforeEach(async function () {
                await doFreshDeploy.bind(this)({
                    payout: payout,
                    owner: owner,
                    operator: operator,
                    useErc20: true
                });
            });

            context('when the operator has an insufficient balance', function () {
                it('should revert', async function () {
                    await expectRevert(
                        this.contract.callUnderscoreHandlePaymentTransfers(
                            operator,
                            this.payoutToken,
                            ether('100001'),
                            [],
                            { from: operator }),
                        'ERC20: transfer amount exceeds balance');
                });
            });

            context('when the sale contract has an insufficient allowance', function () {
                it('should revert', async function () {
                    await expectRevert(
                        this.contract.callUnderscoreHandlePaymentTransfers(
                            operator,
                            this.payoutToken,
                            One,
                            [],
                            { from: operator }),
                        'ERC20: transfer amount exceeds allowance');
                });
            });

            context('when the payment amount is exact and allowed', function () {
                beforeEach(async function() {
                    this.tokenContract = await ERC20.at(this.payoutToken);

                    await this.tokenContract.approve(
                        this.contract.address,
                        One,
                        { from: operator });

                    this.operatorBalance = await this.tokenContract.balanceOf(operator);
                    this.payoutBalance = await this.tokenContract.balanceOf(payout);

                    this.receipt = await this.contract.callUnderscoreHandlePaymentTransfers(
                        operator,
                        this.payoutToken,
                        One,
                        [],
                        { from: operator });
                });

                it('should transfer payment', async function () {
                    const operatorBalance = await this.tokenContract.balanceOf(operator);
                    const payoutBalance = await this.tokenContract.balanceOf(payout);

                    const erc20Sent = this.operatorBalance.sub(operatorBalance);
                    const erc20Received = payoutBalance.sub(this.payoutBalance);

                    erc20Sent.should.be.bignumber.equal(One);
                    erc20Received.should.be.bignumber.equal(One);
                });

                it('should return the correct result', async function () {
                    expectEvent.inTransaction(
                        this.receipt.tx,
                        this.contract,
                        'UnderscoreHandlePaymentTransfersResult',
                        { paymentTransfersInfo: [] });
                });
            });
        });
    });
});
