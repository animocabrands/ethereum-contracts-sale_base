const config = require('@animoca/ethereum-contracts-core_library/truffle-config');

// https://github.com/trufflesuite/truffle/issues/2688#issuecomment-736639231
config.networks.ganache.disableConfirmationListener = true;

module.exports = config;
