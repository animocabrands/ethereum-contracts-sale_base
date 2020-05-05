# Solidity Project Sale Base

This project serves as a base dependency for Solidity-based sale contract projects by providing related base contracts, constants, and interfaces.


## Table of Contents

- [Overview](#overview)
  * [Installation](#installation)
  * [Usage](#usage)
    - [Solidity Contracts](#solidity-contracts)
- [Configurations](#configurations)
  * [Local Ganache for Unit Testing](#local-ganache-for-unit-testing)
  * [Local Ganache for Coverage Testing](#local-ganache-for-coverage-testing)
- [Testing](#testing)


## Overview


### Installation

Install as a module dependency in your host NodeJS project:

```bash
$ npm install --save @animoca/ethereum-contracts-sale_base
```


Edit your **package.json** file to add the following _scripts_ entries:

```json
"scripts": {
  "test": "@animoca/ethereum-contracts-sale_base/scripts/ganache-test.sh",
  "coverage": "@animoca/ethereum-contracts-sale_base/scripts/ganache-coverage.sh"
}
```


Create a **.solcover.js** file in your project root with the following contents:

```javascript
const config = require('@animoca/ethereum-contracts-sale_base/test-environment.config');

module.exports = config;
```


### Usage

#### Solidity Contracts

Import dependency contracts into your Solidity contracts as needed:

```solidity
import "@animoca/ethereum-contracts-sale_base/contracts/{{Contract Group}}/{{Contract}}.sol"
```


## Configurations

The local Ganache blockchain process can be configured for unit testing and/or coverage testing.


### Local Ganache for Unit Testing

The following environment variables are available for customizing the local Ganache blockchain process when performing unit tests:

* **KYBER_SNAPSHOT_PATH** - File path of the local Ganache blockchain snapshot to use (Default: @animoca/ethereum-contracts-sale_base/data/kyber/kyber_snapshot.tar.gz)
* **KYBER_MNEMONIC** - Private key mnemonic to use for all the generated accounts (Default: gesture rather obey video awake genuine patient base soon parrot upset lounge)
* **KYBER_NETWORK_ID** - Blockchain network ID that the local Ganache blockchain will use to identify itself (Default: 4777)
* **GANACHE_DB** - Path to a directory to save the chain database (Default: .ganache_db)
* **GANACHE_PORT** - Port number to listen on (Default: 7545)
* **TOTAL_ACCOUNTS** - Number of accounts to generate at startup (Default: 10)
* **DEFAULT_BALANCE_ETHER** - Amount of ether to assign each test account (Default: 100000000)
* **GAS_LIMIT** - Block gas limit (Default: 0xffffffffffff)
* **HARD_FORK** - The hardfork to use. Supported hardforks are byzantium, constantinople, petersburg, istanbul, and muirGlacier (Default: constantinople)


### Local Ganache for Coverage Testing

The following environment variables are available for customizing the local Ganache blockchain process when performing coverage tests:

* **KYBER_SNAPSHOT_PATH** - File path of the local Ganache blockchain snapshot to use (Default: @animoca/ethereum-contracts-sale_base/data/kyber/kyber_snapshot.tar.gz)
* **GANACHE_DB** - Path to a directory to save the chain database (Default: .ganache_db)
* **GANACHE_PORT** - Port number to listen on (Default: 7545)


You can specify additional Ganache options by modifying the **.solcover.js** you created in your project root:

```javascript
const config = require('@animoca/ethereum-contracts-sale_base/test-environment.config');

config.providerOptions = Object.assign(
    config.providerOptions,
    {
        mnemonic: 'gesture rather obey video awake genuine patient base soon parrot upset lounge',
        db_path: '.ganache_db',
        network_id: 4777,
        port: 8555,
        total_accounts: 10,
        default_balance_ether: 100000000,
        gasLimit: '0xffffffffffff',
        hardfork: 'constantinople'
    }
);

module.exports = config;
```


* **mnemonic** - Private key mnemonic to use for all the generated accounts (Default: gesture rather obey video awake genuine patient base soon parrot upset lounge)
* **network_id** - Blockchain network ID that the local Ganache blockchain will use to identify itself (Default: 4777)
* **db_path** - Path to a directory to save the chain database (Default: .ganache_db)
* **port** - Port number to listen on (Default: 7545)
* **total_accounts** - Number of accounts to generate at startup (Default: 10)
* **default_balance_ether** - Amount of ether to assign each test account (Default: 100000000)
* **gasLimit** - Block gas limit (Default: 0xffffffffffff)
* **hardfork** - The hardfork to use. Supported hardforks are byzantium, constantinople, petersburg, istanbul, and muirGlacier (Default: constantinople)


**IMPORTANT**: If you change the Ganache DB path and/or port, you must do so in both the environment variable and **.solcover.js**


## Testing

Sale base contracts make use of the [KyberNetworkProxy](https://developer.kyber.network/docs/API_ABI-KyberNetworkProxy/) contract to perform token swaps as the payment mechanism using either ETH or any ERC20 compatible token. In order to perform unit tests or execute coverage tests on your sale contracts, the local [Ganache blockchain](https://github.com/trufflesuite/ganache-core) must use a blockchain snapshot that has the _KyberNetworkProxy_ contracts deployed on it. This is accomplished by running the tests using the provided testing scripts and setting them up in the **npm** script hook of the **package.json** file. See the [Installation](#installation) section above for details on how to do this.


Once the _npm_ testing script hooks are setup, you can run the unit tests

```bash
$ npm run test
```


and coverage tests

```bash
$ npm run coverage
```
