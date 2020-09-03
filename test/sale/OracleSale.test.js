const { ether } = require('@openzeppelin/test-helpers');
const Fixture = require('../utils/fixture');
const Path = require('path');
const Resolver = require('@truffle/resolver');
const UniswapV2Fixture = require('../fixtures/uniswapv2.fixture');

const resolver = new Resolver({
    working_directory: __dirname,
    contracts_build_directory: Path.join(__dirname, '../../build'),
    provider: web3.eth.currentProvider,
    gas: 9999999
});

const ERC20 = resolver.require('ERC20', UniswapV2Fixture.UniswapV2PeripheryBuildPath);
const WETH9 = resolver.require('WETH9', UniswapV2Fixture.UniswapV2PeripheryBuildPath);

contract('OracleSale', function (accounts) {
    const loadFixture = Fixture.createFixtureLoader(accounts, web3.eth.currentProvider);

    const tokens = {
        'WETH': {
            abstraction: WETH9,
            supply: ether('10000')},
        'WETHPartner': {
            abstraction: ERC20,
            supply: ether('10000')},
        'TokenA': {
            abstraction: ERC20,
            supply: ether('10000')},
        'TokenB': {
            abstraction: ERC20,
            supply: ether('10000')}
    };

    const tokenPairs = {
        'Pair1': ['WETH', 'WETHPartner'],
        'Pair2': ['TokenA', 'TokenB']
    };

    beforeEach(async function () {
        const fixture = UniswapV2Fixture.get(tokens, tokenPairs);
        const fixtureData = await loadFixture(fixture);
    });
});
