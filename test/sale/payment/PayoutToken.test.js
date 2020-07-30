const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const PayoutToken = artifacts.require('PayoutTokenMock');

contract('PayoutToken', function ([_, owner, other, payoutToken, otherPayoutToken]) {
    beforeEach(async function () {
        this.contract = await PayoutToken.new(payoutToken, { from: owner });
    });

    describe('setPayoutToken()', function () {
        it('should revert if not called by the owner', async function () {
            await expectRevert(
                this.contract.setPayoutToken(otherPayoutToken, { from: other }),
                "Ownable: caller is not the owner");
        });

        it('should revert when setting with the existing payout token', async function () {
            await expectRevert(
                this.contract.setPayoutToken(payoutToken, { from: owner }),
                "PayoutToken: duplicate assignment");
        });

        it('should call _setPayoutToken', async function () {
            const receipt = await this.contract.setPayoutToken(otherPayoutToken, { from: owner });
            expectEvent(
                receipt,
                'PayoutTokenSet');
        });
    });

    describe('_setPayoutToken()', function () {
        it('should update the payout token', async function () {
            let current = await this.contract.payoutToken();
            current.should.be.equal(payoutToken);
            await this.contract.callUnderscoreSetPayoutToken(otherPayoutToken, { from: owner });
            current = await this.contract.payoutToken();
            current.should.be.equal(otherPayoutToken);
        });

        it('should emit the PayoutWalletSet event', async function () {
            const receipt = await this.contract.callUnderscoreSetPayoutToken(otherPayoutToken, { from: owner });
            expectEvent(
                receipt,
                "PayoutTokenSet",
                { payoutToken: otherPayoutToken });
        });
    });
});
