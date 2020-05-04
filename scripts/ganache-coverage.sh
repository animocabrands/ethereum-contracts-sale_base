#Begin openzeppelin-solidity
#
#https://github.com/OpenZeppelin/openzeppelin-solidity
#
#MIT License
#
#Copyright (c) 2016 Smart Contract Solutions, Inc.
#
#Permission is hereby granted, free of charge, to any person obtaining a copy
#of this software and associated documentation files (the "Software"), to deal
#in the Software without restriction, including without limitation the rights
#to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#copies of the Software, and to permit persons to whom the Software is
#furnished to do so, subject to the following conditions:
#
#The above copyright notice and this permission notice shall be included in
#all copies or substantial portions of the Software.
#
#THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
#AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
#THE SOFTWARE.

#!/usr/bin/env bash

KYBER_SNAPSHOT_PATH="$(dirname "$0")/../data/kyber/kyber_snapshot.tar.gz"
KYBER_SNAPSHOT="${KYBER_SNAPSHOT:-$KYBER_SNAPSHOT_PATH}"
GANACHE_DB="${GANACHE_DB:-.ganache_db}"
GANACHE_PORT="${GANACHE_PORT:-8555}"

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
    # Kill the ganache instance that we started (if we started one and if it's still running).
    if [ -n "$ganache_pid" ] && ps -p $ganache_pid >/dev/null; then
        kill -9 $ganache_pid
    fi
    rm -rf $GANACHE_DB
}

ganache_running() {
    nc -z localhost "$GANACHE_PORT"
}

start_ganache() {
    echo "Initialising Ganache DB"
    mkdir -p $GANACHE_DB
    tar xzf $KYBER_SNAPSHOT -C $GANACHE_DB

    # ganache process is auto-managed by the truffle coverage test
    # ganache options are specified in .solcover.js
}

if ganache_running; then
    echo "Using existing ganache instance"
else
    echo "Starting our own ganache instance"
    start_ganache
fi

npx truffle version
npx truffle run coverage --network ganache --temp build "$@"
