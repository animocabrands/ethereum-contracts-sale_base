const {
    utf8ToHex,
    hexToUtf8,
    bytesToHex,
    hexToBytes,
    toHex,
    padLeft,
    padRight,
    toBN,
} = require('web3-utils');

const AbiCoder = require('web3-eth-abi');

function addressToBytes32(value) {
    return uintToBytes32(value);
}

function stringToBytes32(value) {
    return padRight(utf8ToHex(value.slice(0, 32)), 64);
}

function uintToBytes32(value) {
    return padLeft(toHex(value), 64);
}

function bytes32ToAddress(value) {
    return bytes32ToUint(value).toString(16);
}

function bytes32ToString(value) {
    return hexToUtf8(value);
}

function bytes32ToUint(value) {
    return toBN(value);
}

function bytes32ArrayToBytes(values) {
    return bytesToHex([].concat(...values.map(value => hexToBytes(value))));
}

function bytes32ArraysToBytes(arrays) {
    return AbiCoder.encodeParameters(Array(arrays.length).fill('bytes32[]'), arrays);
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

            return bytesOut.concat(bytes32Array.reduce((bytesOut, bytes32Value) => {
                const bytesAppend = hexToBytes(bytes32Value);
                return bytesOut.concat(bytesAppend);
            }, []));
        }, []);
    }

    if (result.length == 0) {
        return null;
    }

    return bytesToHex(result);
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
}
