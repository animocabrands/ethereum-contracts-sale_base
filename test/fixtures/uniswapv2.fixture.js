const Path = require('path');
const Resolver = require('@truffle/resolver');

const resolver = new Resolver({
    working_directory: __dirname,
    contracts_build_directory: Path.join(__dirname, '../../build'),
    provider: web3.eth.currentProvider,
    gas: 9999999
});

const UniswapV2PeripheryBuildPath = Path.join(__dirname, '../../node_modules/@uniswap/v2-periphery/build');
const UniswapV2CoreBuildPath = Path.join(__dirname, '../../node_modules/@uniswap/v2-core/build');

const UniswapV2Factory = resolver.require('UniswapV2Factory', UniswapV2CoreBuildPath);
const UniswapV2Router = resolver.require('UniswapV2Router02', UniswapV2PeripheryBuildPath);
const RouterEventEmitter = resolver.require('RouterEventEmitter', UniswapV2PeripheryBuildPath);

const IUniswapV2Pair = require('@uniswap/v2-core/build/IUniswapV2Pair.json');

let _fixture;

// Arguments:
//
//     const tokens = {
//         <token_key>: {
//             abstraction: <contract_artifact>,
//             supply: <total_token_supply>},
//         ...
//     };
//
//     const tokenPairs = {
//         <token_pair_key>: ['<token_key_0>', '<token_key_1>'],
//         ...
//     };
//
// Returns:
//
//     <Promise> that returns the data resulting from loading the UniswapV2
//     fixture.
//
function get(tokens, tokenPairs) {
    if (!_fixture) {
        _fixture = async ([owner], provider) => {
            for (const [key, data] of Object.entries(tokens)) {
                data.abstraction.defaults({ from: owner });
                data.contract = await data.abstraction.new(data.supply);
            }

            const factory = await UniswapV2Factory.new(owner, { from: owner });

            const router = await UniswapV2Router.new(
                factory.address,
                tokens['WETH'].contract.address,
                { from: owner });

            const routerEventEmitter = await RouterEventEmitter.new({ from: owner });

            const pairs = {};

            for (const [key, tokenKeys] of Object.entries(tokenPairs)) {
                const token0 = tokens[tokenKeys[0]].contract;
                const token1 = tokens[tokenKeys[1]].contract;

                await factory.createPair(
                    token0.address,
                    token1.address,
                    { from: owner });

                const pairAddress = await factory.getPair(
                    token0.address,
                    token1.address,
                    { from: owner });

                const pair = new web3.eth.Contract(
                    IUniswapV2Pair.abi,
                    pairAddress,
                    { from: owner });

                const token0Address = await pair.methods.token0().call({ from: owner });

                const pairData = { contract: pair };

                if (token0.address == token0Address) {
                    pairData.token0 = token0;
                    pairData.token1 = token1;
                } else {
                    pairData.token0 = token1;
                    pairData.token1 = token0;
                }

                pairs[key] = pairData;
            }

            return {
                factory,
                router,
                routerEventEmitter,
                pairs
            };
        }
    }

    return _fixture;
}

module.exports = {
    UniswapV2PeripheryBuildPath,
    UniswapV2CoreBuildPath,
    get
}
