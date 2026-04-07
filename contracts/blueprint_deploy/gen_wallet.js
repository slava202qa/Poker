const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function main() {
    const mnemonic = await mnemonicNew(24);
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    console.log('MNEMONIC=' + mnemonic.join(' '));
    console.log('WALLET_TESTNET=' + wallet.address.toString({ testOnly: true, bounceable: false }));
    console.log('WALLET_MAINNET=' + wallet.address.toString({ testOnly: false, bounceable: false }));
}
main().catch(console.error);
