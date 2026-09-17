import { ethers } from 'hardhat';

async function main() {
  const userAddr = '0x1496b812113d292c4e6f9ec1f41b71910d13d57b';
  const targetRecipient = '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5';
  const gatewayV2 = '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B';
  const gatewayV1 = '0xeF832Ade201962498243bd4819E031746440B4fE';
  const treasuryVault = '0xe59FfB05EdF59464e8803E81A4d790d828915006';

  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();
  console.log('Current Block:', currentBlock);

  const userBal = await provider.getBalance(userAddr);
  const userTxCount = await provider.getTransactionCount(userAddr);
  console.log(`User Address: ${userAddr}`);
  console.log(`User Balance: ${ethers.formatEther(userBal)} BNB`);
  console.log(`User Nonce / Tx Count: ${userTxCount}`);

  const targetBal = await provider.getBalance(targetRecipient);
  console.log(`\nTarget Recipient: ${targetRecipient}`);
  console.log(`Target Balance: ${ethers.formatEther(targetBal)} BNB`);

  async function getEventsInChunks(contract: any, filter: any, startBlock: number, endBlock: number) {
    const CHUNK_SIZE = 400;
    const allEvents: any[] = [];
    for (let from = startBlock; from <= endBlock; from += CHUNK_SIZE) {
      const to = Math.min(from + CHUNK_SIZE - 1, endBlock);
      try {
        const events = await contract.queryFilter(filter, from, to);
        allEvents.push(...events);
      } catch (err) {
        console.error(`Error querying ${from} to ${to}:`, err);
      }
    }
    return allEvents;
  }

  const searchStart = currentBlock - 3000;

  // Query events on Gateway V2
  console.log('\n--- Checking Gateway V2 (0xCB7B...440B) Events ---');
  const gwV2 = await ethers.getContractAt('WalletGateway', gatewayV2);
  const v2Events = await getEventsInChunks(gwV2, gwV2.filters.BNBTransferRouted(), searchStart, currentBlock);
  console.log(`Found ${v2Events.length} BNBTransferRouted events on Gateway V2:`);
  for (const ev of v2Events) {
    const args = (ev as any).args;
    console.log({
      txHash: ev.transactionHash,
      block: ev.blockNumber,
      sender: args[0],
      recipient: args[1],
      totalAmount: ethers.formatEther(args[2]),
      feeAmount: ethers.formatEther(args[3]),
      netAmount: ethers.formatEther(args[4]),
    });
  }

  // Query events on Gateway V1
  console.log('\n--- Checking Gateway V1 (0xeF83...B4fE) Events ---');
  const gwV1 = await ethers.getContractAt('WalletGateway', gatewayV1);
  const v1Events = await getEventsInChunks(gwV1, gwV1.filters.BNBTransferRouted(), searchStart, currentBlock);
  console.log(`Found ${v1Events.length} BNBTransferRouted events on Gateway V1:`);
  for (const ev of v1Events) {
    const args = (ev as any).args;
    console.log({
      txHash: ev.transactionHash,
      block: ev.blockNumber,
      sender: args[0],
      recipient: args[1],
      totalAmount: ethers.formatEther(args[2]),
      feeAmount: ethers.formatEther(args[3]),
      netAmount: ethers.formatEther(args[4]),
    });
  }
}

main().catch(console.error);
