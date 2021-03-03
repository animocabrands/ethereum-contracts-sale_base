const {artifacts, web3} = require('hardhat');

const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router02');
const RouterEventEmitter = artifacts.require('RouterEventEmitter');
const IUniswapV2Pair = artifacts.require('node_modules/@uniswap/v2-core/build:IUniswapV2Pair');

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
        data.abstraction.defaults({from: owner});
        data.contract = await data.abstraction.new(data.supply);
      }

      const factory = await UniswapV2Factory.new(owner, {from: owner});

      const router = await UniswapV2Router.new(factory.address, tokens['WETH'].contract.address, {from: owner});

      const routerEventEmitter = await RouterEventEmitter.new({from: owner});

      const pairs = {};

      for (const [key, tokenKeys] of Object.entries(tokenPairs)) {
        const token0 = tokens[tokenKeys[0]].contract;
        const token1 = tokens[tokenKeys[1]].contract;

        await factory.createPair(token0.address, token1.address, {from: owner});

        const pairAddress = await factory.getPair(token0.address, token1.address, {from: owner});

        const pair = new web3.eth.Contract(IUniswapV2Pair.abi, pairAddress, {from: owner});

        const token0Address = await pair.methods.token0().call({from: owner});

        const pairData = {contract: pair};

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
        pairs,
      };
    };
  }

  return _fixture;
}

function reset() {
  _fixture = undefined;
}

module.exports = {
  get,
  reset,
};
