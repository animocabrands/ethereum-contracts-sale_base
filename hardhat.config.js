require('@animoca/ethereum-contracts-core_library/hardhat-plugins');

module.exports = {
  imports: [ 'node_modules/@uniswap/v2-core/build', 'node_modules/@uniswap/v2-periphery/build' ],
  solidity: {
    compilers: [
      {
        version: '0.6.8',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};
