const { BN, balance, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { Zero } = require('@animoca/ethereum-contracts-core_library').constants;
const { fromWei, toChecksumAddress } = require('web3-utils');

const IERC20 = artifacts.require('IERC20.sol');

/*
 * behavior overrides
 *  contract (address) - sale contract (default: this.contract)
 *  amount (BN) - amount of purchase token to use in the purchase (default: estimatePurchase().totalPrice)
 *  amountVariance (BN) - amount to adjust the purchase token amount by (default: 0)
 *  ethTokenAddress (address) - special purchase token address representing a purchase with ETH (default: this.ethTokenAddress)
 */

function isEthToken(token, overrides = {}) {
    return token === (overrides.ethTokenAddress || this.ethTokenAddress);
}

async function getBalance(token, account, overrides = {}) {
    if (isEthToken.bind(this)(token, overrides)) {
        return await balance.current(account);
    } else {
        const contract = await IERC20.at(token);
        return await contract.balanceOf(account);
    }
}

async function doPurchaseFor(purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
    const contract = overrides.contract || this.contract;

    const estimatePurchase = await contract.estimatePurchase(
        recipient,
        token,
        sku,
        quantity,
        userData,
        { from: purchaser });

    const totalPrice = estimatePurchase.totalPrice;

    let amount = overrides.amount || totalPrice;
    let amountVariance = overrides.amountVariance;

    if (!amountVariance) {
        amountVariance = Zero;
    }

    amount = amount.add(amountVariance);

    let etherValue;

    if (isEthToken.bind(this)(token, overrides)) {
        etherValue = amount;
    } else {
        const erc20Contract = await IERC20.at(token);
        await erc20Contract.approve(contract.address, amount, { from: purchaser });
        etherValue = Zero;
    }

    const purchaseFor = contract.purchaseFor(
        recipient,
        token,
        sku,
        quantity,
        userData,
        {
            from: purchaser,
            value: etherValue
        });

    return {
        purchaseFor,
        totalPrice
    };
}

async function shouldPurchaseFor(purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
    const balanceBefore = await getBalance.bind(this)(token, purchaser, overrides);

    const {
        purchaseFor,
        totalPrice
    } = await doPurchaseFor.bind(this)(
        purchaser,
        recipient,
        token,
        sku,
        quantity,
        userData,
        overrides
    );

    const receipt = await purchaseFor;
    const contract = overrides.contract || this.contract;

    expectEvent.inTransaction(
        receipt.tx,
        contract,
        'Purchase',
        {
            purchaser: purchaser,
            recipient: recipient,
            token: toChecksumAddress(token),
            sku: sku,
            quantity: quantity,
            userData: userData,
            totalPrice: totalPrice
        });

    const balanceAfter = await getBalance.bind(this)(token, purchaser, overrides);
    const balanceDiff = balanceBefore.sub(balanceAfter);

    if (isEthToken.bind(this)(token, overrides)) {
        const gasUsed = new BN(receipt.receipt.gasUsed);
        const gasPrice = new BN(await web3.eth.getGasPrice());
        balanceDiff.should.be.bignumber.equal(totalPrice.add(gasUsed.mul(gasPrice)));
    } else {
        balanceDiff.should.be.bignumber.equal(totalPrice);
    }
}

async function shouldRevertAndNotPurchaseFor(revertMessage, purchaser, recipient, token, sku, quantity, userData, overrides = {}) {
    const {
        purchaseFor
    } = await doPurchaseFor.bind(this)(
        purchaser,
        recipient,
        token,
        sku,
        quantity,
        userData,
        overrides
    );

    if (revertMessage) {
        await expectRevert(purchaseFor, revertMessage);
    } else {
        await expectRevert.unspecified(purchaseFor);
    }
}

module.exports = {
    shouldPurchaseFor,
    shouldRevertAndNotPurchaseFor
};
