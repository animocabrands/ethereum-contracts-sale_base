const {network, artifacts, web3} = require('hardhat');
const {BN, balance, expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const {Zero} = require('@animoca/ethereum-contracts-core_library').constants;

const {shouldBeEqualWithETHDecimalPrecision} = require('@animoca/ethereum-contracts-core_library/test/utils/weiPrecision');

const IERC20 = artifacts.require('@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol:IERC20');

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
  }
  const contract = await IERC20.at(token);
  return await contract.balanceOf(account);
}

async function doPurchaseFor(purchase, overrides = {}) {
  const contract = overrides.contract || this.contract;

  const estimatePurchase = await contract.estimatePurchase(purchase.recipient, purchase.token, purchase.sku, purchase.quantity, purchase.userData, {
    from: purchase.purchaser,
  });

  const totalPrice = estimatePurchase.totalPrice;

  let amount = overrides.amount || totalPrice;
  let amountVariance = overrides.amountVariance;

  if (!amountVariance) {
    amountVariance = Zero;
  }

  amount = amount.add(amountVariance);

  let etherValue;

  if (isEthToken.bind(this)(purchase.token, overrides)) {
    etherValue = amount;
  } else {
    const erc20Contract = await IERC20.at(purchase.token);
    await erc20Contract.approve(contract.address, amount, {from: purchase.purchaser});
    etherValue = Zero;
  }

  const purchaseFor = contract.purchaseFor(purchase.recipient, purchase.token, purchase.sku, purchase.quantity, purchase.userData, {
    from: purchase.purchaser,
    value: etherValue,
  });

  return {
    purchaseFor,
    totalPrice,
  };
}

async function shouldPurchaseFor(purchase, overrides = {}) {
  const balanceBefore = await getBalance.bind(this)(purchase.token, purchase.purchaser, overrides);

  const {purchaseFor, totalPrice} = await doPurchaseFor.bind(this)(purchase, overrides);

  const receipt = await purchaseFor;
  const contract = overrides.contract || this.contract;

  expectEvent(receipt, 'Purchase', {
    purchaser: purchase.purchaser,
    recipient: purchase.recipient,
    token: web3.utils.toChecksumAddress(purchase.token),
    sku: purchase.sku,
    quantity: purchase.quantity,
    userData: purchase.userData,
    totalPrice: totalPrice,
  });

  const balanceAfter = await getBalance.bind(this)(purchase.token, purchase.purchaser, overrides);
  const balanceDiff = balanceBefore.sub(balanceAfter);

  if (isEthToken.bind(this)(purchase.token, overrides)) {
    const gasUsed = new BN(receipt.receipt.gasUsed);
    const gasPrice = new BN(network.config.gasPrice);
    const expected = totalPrice.add(gasUsed.mul(gasPrice));

    if (overrides.totalPricePrecision) {
      shouldBeEqualWithETHDecimalPrecision(balanceDiff, expected, overrides.totalPricePrecision);
    } else {
      balanceDiff.should.be.bignumber.equal(expected);
    }
  } else {
    if (overrides.totalPricePrecision) {
      shouldBeEqualWithETHDecimalPrecision(balanceDiff, totalPrice, overrides.totalPricePrecision);
    } else {
      balanceDiff.should.be.bignumber.equal(totalPrice);
    }
  }
}

async function shouldRevertAndNotPurchaseFor(revertMessage, purchase, overrides = {}) {
  const {purchaseFor} = await doPurchaseFor.bind(this)(purchase, overrides);

  if (revertMessage) {
    await expectRevert(purchaseFor, revertMessage);
  } else {
    await expectRevert.unspecified(purchaseFor);
  }
}

module.exports = {
  shouldPurchaseFor,
  shouldRevertAndNotPurchaseFor,
};
