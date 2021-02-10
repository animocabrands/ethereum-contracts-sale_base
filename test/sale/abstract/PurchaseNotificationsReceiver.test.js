const { web3 } = require('hardhat');
const { ether, expectEvent } = require('@openzeppelin/test-helpers');
const { ZeroAddress, One } = require('@animoca/ethereum-contracts-core_library').constants;
const { stringToBytes32 } = require('../../utils/bytes32');

const PurchaseNotificationsReceiver = artifacts.require('PurchaseNotificationsReceiverMock');

const sku = stringToBytes32('sku');
const ethPrice = ether('0.01');
const userData = '0x00';

let _, owner, purchaser, recipient;

describe('PurchaseNotificationsReceiver', function () {

    before(async function () {
        [
            _,
            owner,
            payoutWallet,
            purchaser,
            recipient
        ] = await web3.eth.getAccounts();
    });

    async function doDeploy(params = {}) {
        this.contract = await PurchaseNotificationsReceiver.new({ from: params.owner || owner });
    }

    describe('onPurchaseNotificationReceived()', function () {

        beforeEach(async function () {
            await doDeploy.bind(this)();
        });

        it('should emit the PurchaseNotificationReceived event', async function () {
            const receipt = await this.contract.onPurchaseNotificationReceived(
                purchaser,
                recipient,
                ZeroAddress,
                sku,
                One,
                userData,
                ethPrice,
                [],
                [],
                [],
                { from: purchaser });

            expectEvent(
                receipt,
                'PurchaseNotificationReceived',
                {});
        });

        it('should return the sha3 hash of the function selector', async function () {
            await this.contract.onPurchaseNotificationReceived(
                purchaser,
                recipient,
                ZeroAddress,
                sku,
                One,
                userData,
                ethPrice,
                [],
                [],
                [],
                { from: purchaser });

            const events = await this.contract.getPastEvents(
                'OnPurchaseNotificationReceivedResult',
                { fromBlock: 'latest' });

            const actual = events[0].args.result;
            const expected = web3.utils.keccak256('onPurchaseNotificationReceived(address,address,address,bytes32,uint256,bytes,uint256,bytes32[],bytes32[],bytes32[])');

            expected.startsWith(actual).should.be.true;
        });

    });

});
