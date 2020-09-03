async function sendAsyncHttp(provider, method, params) {
    if (provider.send.constructor.name === 'AsyncFunction') {
        return provider.send(method, params);
    }

    return new Promise((resolve, reject) => {
        provider.send(
            {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: new Date().getTime()
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
    });
}

async function sendAsync(provider, method, params) {
    switch (provider.constructor.name) {
        case 'HttpProvider':
            return sendAsyncHttp(provider, method, params);
        default:
            throw new Error('Unsupported provider');
    }
};

function createFixtureLoader(accounts, provider) {
    const snapshots = [];

    return async (fixture) => {
        const snapshot = snapshots.find((snapshot) => {
            return snapshot.fixture === fixture;
        });

        if (snapshot) {
            await sendAsync(snapshot.provider, 'evm_revert', [snapshot.id]);
            snapshot.id = await sendAsync(snapshot.provider, 'evm_snapshot', []);
            return snapshot.data;
        } else {
            const data = await fixture(accounts, provider);
            const id = await sendAsync(provider, 'evm_snapshot', []);
            snapshots.push({ fixture, data, id, provider, accounts });
            return data;
        }
    };
}

module.exports = {
    createFixtureLoader
};
