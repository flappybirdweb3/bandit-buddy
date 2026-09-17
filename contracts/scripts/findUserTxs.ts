import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');
  const userAddr = '0x1496b812113d292c4e6f9ec1f41b71910d13d57b';
  const targetRecipient = '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5';
  const gatewayV2 = '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B';
  const gatewayV1 = '0xeF832Ade201962498243bd4819E031746440B4fE';

  const currentBlock = await provider.getBlockNumber();
  console.log('Current block:', currentBlock);

  // Search back 2500 blocks (~2 hours)
  const fromBlock = currentBlock - 2500;
  console.log(`Searching from ${fromBlock} to ${currentBlock}...`);

  const contractsToScan = [
    { name: 'Gateway V2', address: gatewayV2 },
    { name: 'Gateway V1', address: gatewayV1 },
  ];

  for (const c of contractsToScan) {
    console.log(`\nScanning ${c.name} (${c.address})...`);
    let foundLogs: any[] = [];
    for (let b = fromBlock; b <= currentBlock; b += 90) {
      const to = Math.min(b + 89, currentBlock);
      try {
        const logs = await provider.getLogs({
          address: c.address,
          fromBlock: b,
          toBlock: to,
        });
        if (logs.length > 0) {
          foundLogs.push(...logs);
        }
      } catch (e: any) {
        console.error(`Error on chunk ${b}-${to}:`, e.message);
      }
    }
    console.log(`Found ${foundLogs.length} logs for ${c.name}`);
    for (const l of foundLogs) {
      console.log('Log TxHash:', l.transactionHash, 'Block:', l.blockNumber);
      const tx = await provider.getTransaction(l.transactionHash);
      const receipt = await provider.getTransactionReceipt(l.transactionHash);
      console.log('  From:', tx?.from, 'To:', tx?.to, 'Value:', ethers.formatEther(tx?.value || 0n));
      console.log('  Status:', receipt?.status);
    }
  }
}

main().catch(console.error);
