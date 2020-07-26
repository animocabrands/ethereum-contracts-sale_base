const { expectEvent } = require('@openzeppelin/test-helpers');
const { EthAddress, One } = require('@animoca/ethereum-contracts-core_library').constants;

const Payment = artifacts.require('PaymentMock');

contract('Payment', function ([_, payout, owner]) {
    beforeEach(async function () {
        this.contract = await Payment.new(payout, { from: owner });
    });

    describe('_handlePaymentAmount', function () {
        it('should return the correct result', async function () {
            const result = await this.contract.callUnderscoreHandlePaymentAmount(
                EthAddress,
                One,
                []);

            result.length.should.be.equal(0);
        });
    });
});
