const {web3} = require('hardhat');

function addressToBytes32(value) {
  return uintToBytes32(value);
}

function stringToBytes32(value) {
  return web3.utils.padRight(web3.utils.utf8ToHex(value.slice(0, 32)), 64);
}

function uintToBytes32(value) {
  return web3.utils.padLeft(web3.utils.toHex(value), 64);
}

function bytes32ToAddress(value) {
  return bytes32ToUint(value).toString(16);
}

function bytes32ToString(value) {
  return web3.utils.hexToUtf8(value);
}

function bytes32ToUint(value) {
  return web3.utils.toBN(value);
}

function bytes32ArrayToBytes(values) {
  return web3.utils.bytesToHex([].concat(...values.map((value) => web3.utils.hexToBytes(value))));
}

function bytes32ArraysToBytes(arrays) {
  return web3.eth.abi.encodeParameters(Array(arrays.length).fill('bytes32[]'), arrays);
}

function bytes32ArraysToBytesPacked(arrays) {
  let result;

  if (arrays.length == 0) {
    result = [];
  } else {
    result = arrays.reduce((bytesOut, bytes32Array) => {
      if (bytes32Array.length == 0) {
        return bytesOut;
      }

      return bytesOut.concat(
        bytes32Array.reduce((bytesOut, bytes32Value) => {
          const bytesAppend = web3.utils.hexToBytes(bytes32Value);
          return bytesOut.concat(bytesAppend);
        }, [])
      );
    }, []);
  }

  if (result.length == 0) {
    return null;
  }

  return web3.utils.bytesToHex(result);
}

module.exports = {
  addressToBytes32,
  stringToBytes32,
  uintToBytes32,
  bytes32ToAddress,
  bytes32ToString,
  bytes32ToUint,
  bytes32ArrayToBytes,
  bytes32ArraysToBytes,
  bytes32ArraysToBytesPacked,
};
