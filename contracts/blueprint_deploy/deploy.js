const { beginCell, contractAddress, toNano, TonClient4, WalletContractV4, internal } = require('@ton/core');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { compileFunc } = require('@ton-community/func-js');
const fs = require('fs');
const path = require('path');

async function main() {
    const mnemonic = process.env.OWNER_MNEMONIC || '';
    if (!mnemonic) { console.error('Set OWNER_MNEMONIC'); process.exit(1); }

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    console.log('Owner wallet:', wallet.address.toString({ testOnly: true }));

    const result = await compileFunc({
        sources: {
            'stdlib.fc': fs.readFileSync(path.join(__dirname, '../stdlib.fc'), 'utf8'),
            'poker_vault.fc': fs.readFileSync(path.join(__dirname, '../poker_vault.fc'), 'utf8'),
        },
        entryPoints: ['poker_vault.fc'],
    });

    if (result.status === 'error') {
        console.error('Compile error:', result.message);
        process.exit(1);
    }
    console.log('Contract compiled OK');

    const { Cell } = require('@ton/core');
    const codeCell = Cell.fromBoc(Buffer.from(result.codeBoc, 'base64'))[0];

    const dataCell = beginCell()
        .storeAddress(wallet.address)
        .storeUint(0, 64)
        .storeUint(0, 32)
        .endCell();

    const stateInit = { code: codeCell, data: dataCell };
    const contractAddr = contractAddress(0, stateInit);
    console.log('Contract address:', contractAddr.toString({ testOnly: true }));

    // Save address to file
    fs.writeFileSync(path.join(__dirname, 'contract_address.txt'), contractAddr.toString({ testOnly: true }));
    console.log('\nAdd to .env on server:');
    console.log('CONTRACT_ADDRESS=' + contractAddr.toString({ testOnly: true }));
}

main().catch(e => { console.error(e); process.exit(1); });
