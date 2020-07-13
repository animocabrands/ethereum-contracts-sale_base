const { BN, ether } = require('@openzeppelin/test-helpers');
const { asciiToHex } = require('web3-utils');
const { EthAddress, ZeroAddress } = require('@animoca/ethereum-contracts-core_library').constants;

const Sale = artifacts.require('SimpleSaleMock.sol');
const ERC20 = artifacts.require('ERC20Mock.sol');
const IERC20 = artifacts.require('IERC20.sol');

const prices = {
    'both': {
        ethPrice: ether('0.01'),
        erc20Price: ether('1')
    },
    'ethOnly': {
        ethPrice: ether('0.01'),
        erc20Price: new BN('0')
    },
    'erc20Only': {
        ethPrice: new BN('0'),
        erc20Price: ether('1')
    },
};

const purchaseData = asciiToHex('some data');

async function doFreshDeploy(params) {
    let payoutToken;

    if (params.useErc20) {
        const erc20Token = await ERC20.new(ether('1000000000'), { from: params.owner });
        await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
        await erc20Token.transfer(params.purchaser, ether('100000'), { from: params.owner });
        payoutToken = erc20Token.address;
        this.payoutToken = payoutToken;
    } else {
        payoutToken = ZeroAddress;
        this.payoutToken = EthAddress;
    }

    this.contract = await Sale.new(params.payout, payoutToken, { from: params.owner });

    if (params.setPrices) {
        for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
            const sku = asciiToHex(purchaseId);
            await this.contract.setPrice(sku, ethPrice, erc20Price, { from: params.owner });
        }
    }

    await this.contract.start({ from: params.owner });
};

async function getPrice(sale, purchaseId, quantity, paymentToken) {
    const sku = asciiToHex(purchaseId);
    const { ethPrice, erc20Price } = await sale.getPrice(sku);
    return (paymentToken == EthAddress) ? ethPrice.mul(new BN(quantity)) : erc20Price.mul(new BN(quantity));
}

async function purchaseFor(sale, purchaser, purchaseId, quantity, paymentToken, operator, overrides) {
    const price = await getPrice(sale, purchaseId, quantity, paymentToken);

    let value = price;

    if (overrides) {
        if (overrides.purchaseId !== undefined) {
            purchaseId = overrides.purchaseId;
        }

        if (overrides.value !== undefined) {
            value = overrides.value;
        }
    }

    let etherValue = value;

    if (paymentToken != EthAddress) {
        const ERC20Contract = await IERC20.at(paymentToken);
        // approve first for sale
        await ERC20Contract.approve(sale.address, value, { from: operator });
        // do not send any ether
        etherValue = 0;
    }

    const sku = asciiToHex(purchaseId);

    // console.log(`Purchasing ${quantity}*'${purchaseId}'`);
    return sale.purchaseFor(
        purchaser,
        sku,
        quantity,
        paymentToken,
        [ purchaseData ],
        {
            from: operator,
            value: etherValue,
            gasPrice: 1
        }
    );
}

module.exports = {
    doFreshDeploy,
    prices,
    purchaseFor,
    getPrice,
    purchaseData
};
