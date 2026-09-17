import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');
  const txHashes = [
    '0x73ef0a9414ad58595740b7395799f15ec6bb7cf292e50d6cc618ee2ee177d1de',
    '0xadbf4d207377e7ab6c849628dee779ba5b54b92cb53dcd6cf5ea4b264d69a352',
  ];

  const targetRecipient = '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5';
  const treasuryVault = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
  const gatewayAddr = '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B';

  const gatewayAbi = [
    'event BNBTransferRouted(address indexed sender, address indexed recipient, uint256 totalAmount, uint256 feeAmount, uint256 netAmount)',
  ];
  const vaultAbi = [
    'event FundsReceived(address indexed sender, uint256 amount)',
  ];

  const ifaceGateway = new ethers.Interface(gatewayAbi);
  const ifaceVault = new ethers.Interface(vaultAbi);

  console.log('========================================================================');
  console.log('🔍 VERIFYING USER (TG: 5586418550) 2 WITHDRAWAL TRANSACTIONS');
  console.log('========================================================================\n');

  for (let i = 0; i < txHashes.length; i++) {
    const hash = txHashes[i];
    console.log(`>>> [TRANSACTION #${i + 1}] ${hash}`);

    const tx = await provider.getTransaction(hash);
    const receipt = await provider.getTransactionReceipt(hash);

    if (!tx || !receipt) {
      console.log('  ❌ Transaction not found on chain!');
      continue;
    }

    const block = receipt.blockNumber;
    const blockData = await provider.getBlock(block);
    const timestamp = blockData ? new Date(blockData.timestamp * 1000).toISOString() : 'Unknown';

    console.log(`  - Status:           ${receipt.status === 1 ? '✅ 1 (SUCCESS / CONFIRMED)' : '❌ FAILED'}`);
    console.log(`  - Block Number:     ${block}`);
    console.log(`  - Timestamp:        ${timestamp}`);
    console.log(`  - From (Sender):    ${tx.from}`);
    console.log(`  - To (Gateway):     ${tx.to}`);
    console.log(`  - Gross Sent:       ${ethers.formatEther(tx.value)} BNB`);
    console.log(`  - Gas Used:         ${receipt.gasUsed.toString()} gas`);

    // Parse Logs
    let routedEvent: any = null;
    let vaultReceivedEvent: any = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === gatewayAddr.toLowerCase()) {
        try {
          routedEvent = ifaceGateway.parseLog(log);
        } catch {}
      }
      if (log.address.toLowerCase() === treasuryVault.toLowerCase()) {
        try {
          vaultReceivedEvent = ifaceVault.parseLog(log);
        } catch {}
      }
    }

    if (routedEvent) {
      console.log('\n  --- Gateway Event: BNBTransferRouted ---');
      console.log(`    Sender:        ${routedEvent.args[0]}`);
      console.log(`    Recipient:     ${routedEvent.args[1]}`);
      console.log(`    Total Amount:  ${ethers.formatEther(routedEvent.args[2])} BNB`);
      console.log(`    Fee Amount:    ${ethers.formatEther(routedEvent.args[3])} BNB (0.3% Tax)`);
      console.log(`    Net Amount:    ${ethers.formatEther(routedEvent.args[4])} BNB (99.7% Received)`);

      const targetMatch = routedEvent.args[1].toLowerCase() === targetRecipient.toLowerCase();
      console.log(`    Recipient Match Target (0xB32d...): ${targetMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
    }

    if (vaultReceivedEvent) {
      console.log('\n  --- Treasury Vault Event: FundsReceived ---');
      console.log(`    Vault Sender:  ${vaultReceivedEvent.args[0]}`);
      console.log(`    Amount In:     ${ethers.formatEther(vaultReceivedEvent.args[1])} BNB`);
      console.log(`    Vault Received Tax Verified: ✅ YES`);
    }

    // Block Delta balance analysis
    const preVaultBal = await provider.getBalance(treasuryVault, block - 1);
    const postVaultBal = await provider.getBalance(treasuryVault, block);
    const vaultDelta = postVaultBal - preVaultBal;

    const preRecipientBal = await provider.getBalance(targetRecipient, block - 1);
    const postRecipientBal = await provider.getBalance(targetRecipient, block);
    const recipientDelta = postRecipientBal - preRecipientBal;

    console.log('\n  --- On-Chain State Balance Deltas at Block ---');
    console.log(`    Treasury Vault Delta:  +${ethers.formatEther(vaultDelta)} BNB`);
    console.log(`    Recipient Net Delta:   +${ethers.formatEther(recipientDelta)} BNB`);

    const expectedFee = (tx.value * 30n) / 10000n;
    const expectedNet = tx.value - expectedFee;

    const feeMatches = vaultDelta === expectedFee;
    const netMatches = recipientDelta === expectedNet;

    console.log(`    Fee Math Validation (0.3%): ${feeMatches ? '✅ 100% EXACT' : '❌ MISMATCH'}`);
    console.log(`    Net Math Validation (99.7%): ${netMatches ? '✅ 100% EXACT' : '❌ MISMATCH'}`);
    console.log(`  - BscScan Link: https://testnet.bscscan.com/tx/${hash}\n`);
  }
}

main().catch(console.error);
