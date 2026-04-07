"""
Deploy PokerVault contract to TON testnet.

Usage:
    python deploy.py [--mainnet]

Steps:
1. Generates or loads owner wallet from mnemonic
2. Compiles poker_vault.fc via func-js
3. Deploys contract to testnet (or mainnet with --mainnet flag)
4. Prints contract address to add to .env

Requirements:
    pip install tonsdk pytoniq pytoniq-core requests
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

import requests

TESTNET_API = "https://testnet.toncenter.com/api/v2"
MAINNET_API = "https://toncenter.com/api/v2"

# Minimal initial data for contract storage:
# owner_address (MsgAddress) + platform_balance (uint64=0) + last_tournament_id (uint32=0)


def compile_contract():
    """Compile poker_vault.fc and return BoC bytes."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    stdlib = os.path.join(script_dir, "stdlib.fc")
    contract = os.path.join(script_dir, "poker_vault.fc")
    out_fif = os.path.join(script_dir, "poker_vault.fif")

    result = subprocess.run(
        ["func-js", stdlib, contract, "-o", out_fif],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("Compilation error:", result.stderr)
        sys.exit(1)
    print("✅ Contract compiled")
    return out_fif


def get_or_create_wallet(mnemonic_words=None):
    """Return (wallet, mnemonics, private_key)."""
    from tonsdk.contract.wallet import Wallets, WalletVersionEnum
    from tonsdk.crypto import mnemonic_new

    if mnemonic_words:
        mnemonics = mnemonic_words.split()
    else:
        mnemonics = mnemonic_new(24)
        print("🔑 Generated new mnemonic (SAVE THIS!):")
        print(" ".join(mnemonics))

    _mn, pub_k, priv_k, wallet = Wallets.from_mnemonics(
        mnemonics, WalletVersionEnum.v4r2, 0
    )
    return wallet, mnemonics, priv_k


def get_balance(address: str, api_url: str, api_key: str = "") -> int:
    headers = {"X-API-Key": api_key} if api_key else {}
    r = requests.get(f"{api_url}/getAddressBalance?address={address}", headers=headers)
    return int(r.json().get("result", 0))


def deploy_contract(wallet, priv_k, api_url: str, api_key: str = ""):
    """Deploy PokerVault contract. Returns contract address."""
    from tonsdk.utils import Address, to_nano
    from tonsdk.boc import Cell

    owner_addr = wallet.address.to_string(True, True, True)
    print(f"📬 Owner wallet: {owner_addr}")

    balance = get_balance(owner_addr, api_url, api_key)
    print(f"💰 Wallet balance: {balance / 1e9:.4f} TON")

    if balance < to_nano(0.1, "ton"):
        print("\n⚠️  Wallet needs at least 0.1 TON to deploy.")
        print(f"   Send TON to: {owner_addr}")
        if "testnet" in api_url:
            print("   Testnet faucet: https://t.me/testgiver_ton_bot")
        print("\nWaiting for funds", end="", flush=True)
        for _ in range(60):
            time.sleep(5)
            balance = get_balance(owner_addr, api_url, api_key)
            if balance >= to_nano(0.1, "ton"):
                print(f"\n✅ Received {balance / 1e9:.4f} TON")
                break
            print(".", end="", flush=True)
        else:
            print("\n❌ Timeout waiting for funds")
            sys.exit(1)

    # Build initial contract data cell
    # Storage: owner_address + platform_balance(uint64=0) + last_tournament_id(uint32=0)
    data_cell = Cell()
    # Encode owner address as MsgAddress (simplified — workchain 0)
    addr_obj = Address(owner_addr)
    data_cell.bits.write_uint(0b100, 3)   # addr_std tag
    data_cell.bits.write_uint(0, 1)       # anycast = none
    data_cell.bits.write_int(addr_obj.wc, 8)
    data_cell.bits.write_bytes(addr_obj.hash_part)
    data_cell.bits.write_uint(0, 64)      # platform_balance = 0
    data_cell.bits.write_uint(0, 32)      # last_tournament_id = 0

    # Read compiled code BoC
    script_dir = os.path.dirname(os.path.abspath(__file__))
    boc_path = os.path.join(script_dir, "poker_vault.boc")

    if not os.path.exists(boc_path):
        print("❌ poker_vault.boc not found. Run compile step first.")
        sys.exit(1)

    with open(boc_path, "rb") as f:
        code_boc = f.read()

    from tonsdk.boc import Cell as BocCell
    code_cell = BocCell.one_from_boc(code_boc)

    # Get seqno
    headers = {"X-API-Key": api_key} if api_key else {}
    r = requests.get(
        f"{api_url}/runGetMethod",
        params={"address": owner_addr, "method": "seqno", "stack": "[]"},
        headers=headers
    )
    seqno = 0
    try:
        seqno = int(r.json()["result"]["stack"][0][1], 16)
    except Exception:
        seqno = 0

    # Create deploy message
    deploy_msg = wallet.create_init_external_message()
    state_init = wallet.create_state_init()

    # Calculate contract address from state_init
    import hashlib
    state_init_hash = hashlib.sha256(state_init["state_init"].to_boc(False)).digest()
    contract_addr = f"0:{state_init_hash.hex()}"

    print(f"📋 Contract address (predicted): {contract_addr}")

    # Send deploy transaction
    transfer = wallet.create_transfer_message(
        to_addr=contract_addr,
        amount=to_nano(0.05, "ton"),
        seqno=seqno,
        state_init=state_init["state_init"],
    )

    boc_b64 = transfer["message"].to_boc(False).hex()
    r = requests.post(
        f"{api_url}/sendBocReturnHash",
        json={"boc": boc_b64},
        headers=headers
    )
    result = r.json()
    print(f"📤 Deploy tx: {result}")

    return contract_addr


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mainnet", action="store_true")
    parser.add_argument("--mnemonic", type=str, default="", help="24-word mnemonic")
    parser.add_argument("--api-key", type=str, default="", help="Toncenter API key")
    args = parser.parse_args()

    api_url = MAINNET_API if args.mainnet else TESTNET_API
    network = "MAINNET" if args.mainnet else "TESTNET"
    print(f"🌐 Deploying to {network}: {api_url}\n")

    # Step 1: compile
    compile_contract()

    # Step 2: compile to BoC using fift
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Try func-js with boc output
    result = subprocess.run(
        ["func-js",
         os.path.join(script_dir, "stdlib.fc"),
         os.path.join(script_dir, "poker_vault.fc"),
         "--boc", os.path.join(script_dir, "poker_vault.boc")],
        capture_output=True, text=True
    )
    if result.returncode != 0 or not os.path.exists(os.path.join(script_dir, "poker_vault.boc")):
        print("⚠️  BoC output not supported by this func-js version")
        print("   Using Blueprint for deployment instead...")
        _deploy_via_blueprint(args, api_url, network)
        return

    # Step 3: wallet + deploy
    mnemonic = args.mnemonic or os.environ.get("OWNER_MNEMONIC", "")
    wallet, mnemonics, priv_k = get_or_create_wallet(mnemonic)
    contract_addr = deploy_contract(wallet, priv_k, api_url, args.api_key)

    print(f"\n{'='*60}")
    print(f"✅ CONTRACT DEPLOYED")
    print(f"   Address: {contract_addr}")
    print(f"\nAdd to .env on your server:")
    print(f"   CONTRACT_ADDRESS={contract_addr}")
    if not mnemonic:
        print(f"   OWNER_MNEMONIC={' '.join(mnemonics)}")
    print(f"{'='*60}")


def _deploy_via_blueprint(args, api_url, network):
    """Fallback: use TON Blueprint for deployment."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    blueprint_dir = os.path.join(script_dir, "blueprint_deploy")
    os.makedirs(blueprint_dir, exist_ok=True)

    print("\n📦 Setting up TON Blueprint project...")
    subprocess.run(["npm", "init", "-y"], cwd=blueprint_dir, capture_output=True)
    subprocess.run(
        ["npm", "install", "--save-dev", "@ton/blueprint", "@ton/core", "@ton/crypto"],
        cwd=blueprint_dir, capture_output=True
    )

    # Write deploy script
    deploy_script = f"""
const {{ beginCell, contractAddress, toNano, TonClient, WalletContractV4, internal }} = require('@ton/core');
const {{ mnemonicToPrivateKey }} = require('@ton/crypto');
const {{ compileFunc }} = require('@ton-community/func-js');
const fs = require('fs');
const path = require('path');

async function main() {{
    const mnemonic = process.env.OWNER_MNEMONIC || '';
    if (!mnemonic) {{ console.error('Set OWNER_MNEMONIC env var'); process.exit(1); }}

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({{ publicKey: keyPair.publicKey, workchain: 0 }});

    const client = new TonClient({{
        endpoint: '{api_url}/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY || '',
    }});

    // Compile contract
    const result = await compileFunc({{
        sources: {{
            'stdlib.fc': fs.readFileSync(path.join(__dirname, '../stdlib.fc'), 'utf8'),
            'poker_vault.fc': fs.readFileSync(path.join(__dirname, '../poker_vault.fc'), 'utf8'),
        }},
        entryPoints: ['poker_vault.fc'],
    }});

    if (result.status === 'error') {{
        console.error('Compile error:', result.message);
        process.exit(1);
    }}

    const codeCell = Cell.fromBoc(Buffer.from(result.codeBoc, 'base64'))[0];

    // Build initial data
    const ownerAddr = wallet.address;
    const dataCell = beginCell()
        .storeAddress(ownerAddr)
        .storeUint(0, 64)
        .storeUint(0, 32)
        .endCell();

    const stateInit = {{ code: codeCell, data: dataCell }};
    const contractAddr = contractAddress(0, stateInit);

    console.log('Contract address:', contractAddr.toString());

    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    await walletContract.sendTransfer({{
        secretKey: keyPair.secretKey,
        seqno,
        messages: [internal({{
            to: contractAddr,
            value: toNano('0.05'),
            init: stateInit,
            body: beginCell().endCell(),
        }})],
    }});

    console.log('\\nDeploy sent! Add to .env:');
    console.log('CONTRACT_ADDRESS=' + contractAddr.toString());
}}

main().catch(console.error);
"""

    with open(os.path.join(blueprint_dir, "deploy.js"), "w") as f:
        f.write(deploy_script)

    print(f"\nRun this to deploy:")
    print(f"  cd {blueprint_dir}")
    print(f"  OWNER_MNEMONIC='your 24 words' node deploy.js")


if __name__ == "__main__":
    main()
