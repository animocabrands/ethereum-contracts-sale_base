const { BN, ether } = require('@openzeppelin/test-helpers');
const { EthAddress, ZeroAddress } = require('@animoca/ethereum-contracts-core_library').constants;

const Sale = artifacts.require('SimpleSaleMock.sol');
const ERC20Token = artifacts.require('ERC20Mock.sol');
const ERC20 = artifacts.require('ERC20.sol');

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

async function doFreshDeploy(params) {
    let erc20TokenAddress;

    if (params.useErc20) {
        const erc20Token = await ERC20Token.new(ether('1000000000'), { from: params.owner });
        await erc20Token.transfer(params.operator, ether('100000'), { from: params.owner });
        await erc20Token.transfer(params.recipient, ether('100000'), { from: params.owner });
        erc20TokenAddress = erc20Token.address;
        this.erc20TokenAddress = erc20TokenAddress;
    } else {
        erc20TokenAddress = ZeroAddress;
        this.erc20TokenAddress = EthAddress;
    }

    this.contract = await Sale.new(params.payout, erc20TokenAddress, { from: params.owner });

    if (params.setPrices) {
        for (const [purchaseId, { ethPrice, erc20Price }] of Object.entries(prices)) {
            await this.contract.setPrice(purchaseId, ethPrice, erc20Price, { from: params.owner });
        }
    }
};

async function getPrice(sale, purchaseId, quantity, paymentToken) {
    const { ethPrice, erc20Price } = await sale.prices(purchaseId);
    return (paymentToken == EthAddress) ? ethPrice.mul(new BN(quantity)) : erc20Price.mul(new BN(quantity));
}

async function purchaseFor(sale, recipient, purchaseId, quantity, paymentToken, operator, overrides) {
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
        const ERC20Contract = await ERC20.at(paymentToken);
        // approve first for sale
        await ERC20Contract.approve(sale.address, value, { from: operator });
        // do not send any ether
        etherValue = 0;
    }

    // console.log(`Purchasing ${quantity}*'${purchaseId}'`);
    return sale.purchaseFor(
        recipient,
        purchaseId,
        paymentToken,
        quantity,
        '',
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
    getPrice
};
