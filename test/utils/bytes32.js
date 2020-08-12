const {
    asciiToHex,
    hexToAscii,
    toHex,
    padLeft,
    padRight,
    toBN
} = require('web3-utils');

function addressToBytes32(value) {
    return uintToBytes32(value);
}

function stringToBytes32(value) {
    return padRight(asciiToHex(value.slice(0, 32)), 64);
}

function uintToBytes32(value) {
    return padLeft(toHex(value), 64);
}

function bytes32ToAddress(value) {
    return bytes32ToUint(value).toString(16);
}

function bytes32ToString(value) {
    return hexToAscii(value);
}

function bytes32ToUint(value) {
    return toBN(value);
}

module.exports = {
    addressToBytes32,
    stringToBytes32,
    uintToBytes32,
    bytes32ToAddress,
    bytes32ToString,
    bytes32ToUint
}
