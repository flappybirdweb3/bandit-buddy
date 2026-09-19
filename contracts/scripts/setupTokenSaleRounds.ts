/**
 * Setup FarmTokenSale round times to match homepage dates:
 *   Angel:   2026-10-01 → 2026-10-30 (UTC+7)
 *   Private: 2026-11-01 → 2026-11-30 (UTC+7)
 *   Public:  2026-12-01 → 2026-12-30 (UTC+7)
 */
import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const toTs = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const ROUNDS = [
  { id: 0, name: 'Angel',   start: '2026-10-01T00:00:00+07:00', end: '2026-10-30T23:59:59+07:00' },
  { id: 1, name: 'Private', start: '2026-11-01T00:00:00+07:00', end: '2026-11-30T23:59:59+07:00' },
  { id: 2, name: 'Public',  start: '2026-12-01T00:00:00+07:00', end: '2026-12-30T23:59:59+07:00' },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const depFile = path.join(__dirname, '../deployment.bscTestnet.json');
  const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
  const saleAddr = dep['FarmTokenSale'];
  if (!saleAddr) throw new Error('FarmTokenSale not found in deployment.bscTestnet.json');

  const sale = await ethers.getContractAt('FarmTokenSale', saleAddr);
  console.log(`FarmTokenSale: ${saleAddr}\n`);

  for (const r of ROUNDS) {
    const startTs = toTs(r.start);
    const endTs   = toTs(r.end);
    console.log(`Setting Round ${r.id} (${r.name}): ${new Date(startTs*1000).toISOString()} → ${new Date(endTs*1000).toISOString()}`);
    const tx = await sale.setRoundTimes(r.id, startTs, endTs);
    await tx.wait();
    console.log(`  TxHash: ${tx.hash}`);
  }

  console.log('\nAll rounds configured.');
}

main().catch((e) => { console.error(e); process.exit(1); });
