const { mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4, TonClient, beginCell, contractAddress, toNano, internal, Cell } = require('@ton/ton');
const { compileFunc } = require('@ton-community/func-js');
const fs = require('fs');
const path = require('path');

const MNEMONIC = process.env.OWNER_MNEMONIC;
const API_KEY = process.env.TONCENTER_API_KEY || '';
const TESTNET = process.env.MAINNET !== '1';

async function main() {
    if (!MNEMONIC) { console.error('Set OWNER_MNEMONIC env var'); process.exit(1); }

    const keyPair = await mnemonicToPrivateKey(MNEMONIC.split(' '));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const walletAddr = wallet.address.toString({ testOnly: TESTNET, bounceable: false });
    console.log('Owner wallet:', walletAddr);

    // Compile contract — use targets array format
    const stdlibSrc = fs.readFileSync(path.join(__dirname, '../stdlib.fc'), 'utf8');
    const contractSrc = fs.readFileSync(path.join(__dirname, '../poker_vault.fc'), 'utf8');

    const result = await compileFunc({
        sources: [
            { filename: 'stdlib.fc', content: stdlibSrc },
            { filename: 'poker_vault.fc', content: contractSrc },
        ],
        targets: ['poker_vault.fc'],
    });

    if (result.status === 'error') {
        console.error('Compile error:', result.message);
        process.exit(1);
    }
    console.log('Contract compiled OK');

    const codeCell = Cell.fromBoc(Buffer.from(result.codeBoc, 'base64'))[0];
    const dataCell = beginCell()
        .storeAddress(wallet.address)
        .storeUint(0, 64)
        .storeUint(0, 32)
        .endCell();

    const stateInit = { code: codeCell, data: dataCell };
    const contractAddr = contractAddress(0, stateInit);
    const contractAddrStr = contractAddr.toString({ testOnly: TESTNET, bounceable: true });
    console.log('Contract address:', contractAddrStr);

    const endpoint = TESTNET
        ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
        : 'https://toncenter.com/api/v2/jsonRPC';

    const client = new TonClient({ endpoint, apiKey: API_KEY });
    const walletContract = client.open(wallet);

    let balance = 0n;
    try { balance = await walletContract.getBalance(); } catch(e) {}
    console.log('Wallet balance:', Number(balance) / 1e9, 'TON');

    if (balance < toNano('0.05')) {
        console.log('\n⚠️  Need 0.05 TON. Send to:', walletAddr);
        if (TESTNET) console.log('Faucet: https://t.me/testgiver_ton_bot');
        console.log('CONTRACT_ADDRESS=' + contractAddrStr);
        fs.writeFileSync(path.join(__dirname, 'contract_address.txt'), contractAddrStr);
        return;
    }

    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
        secretKey: keyPair.secretKey,
        seqno,
        messages: [internal({ to: contractAddr, value: toNano('0.05'), init: stateInit, body: beginCell().endCell() })],
    });

    console.log('✅ Deploy sent! CONTRACT_ADDRESS=' + contractAddrStr);
    fs.writeFileSync(path.join(__dirname, 'contract_address.txt'), contractAddrStr);
}

main().catch(e => { console.error(e.message); process.exit(1); });
