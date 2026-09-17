/**
 * #98 SC-FIX-2 — Exclude all in-game contracts from DEX tax.
 *
 * Run IMMEDIATELY after FarmToken V2 deploy, before any other contract migration.
 * Usage: npx hardhat run scripts/setExcludeFromFee.ts --network bscTestnet
 *        FARM_TOKEN_ADDRESS=0x... npx hardhat run scripts/setExcludeFromFee.ts --network bscTestnet
 */
import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const FARM_TOKEN_ABI = [
  'function excludeFromFee(address account, bool excluded) external',
  'function isExcludedFromFee(address account) external view returns (bool)',
  'function owner() external view returns (address)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Caller:  ${deployer.address}`);

  const farmTokenAddress = process.env.FARM_TOKEN_ADDRESS;
  if (!farmTokenAddress || !ethers.isAddress(farmTokenAddress)) {
    throw new Error('FARM_TOKEN_ADDRESS not set or invalid in .env');
  }
  console.log(`FarmToken: ${farmTokenAddress}\n`);

  const farmToken = new ethers.Contract(farmTokenAddress, FARM_TOKEN_ABI, deployer);

  const contractOwner: string = await farmToken.owner();
  if (contractOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Caller ${deployer.address} is not owner (${contractOwner}). Use the deployer wallet.`,
    );
  }

  // Full exclusion list per Sprint 7 audit (#98)
  const toExclude: Array<{ name: string; envKey: string }> = [
    { name: 'BanditMarket v2',      envKey: 'MARKET_CONTRACT_ADDRESS' },
    { name: 'BanditDogFusion v3',   envKey: 'GACHA_CONTRACT_ADDRESS' },
    { name: 'GuildStaking',         envKey: 'GUILD_STAKING_ADDRESS' },
    { name: 'FarmTokenClaim',       envKey: 'CLAIM_CONTRACT_ADDRESS' },
    { name: 'Treasury (buyback)',   envKey: 'TREASURY_CONTRACT_ADDRESS' },
    { name: 'Treasury (deposit)',   envKey: 'TREASURY_ADDRESS' },
  ];

  let excluded = 0;
  let skipped  = 0;

  for (const { name, envKey } of toExclude) {
    const addr = process.env[envKey];
    if (!addr || !ethers.isAddress(addr)) {
      console.warn(`  SKIP ${name}: ${envKey} not set or invalid`);
      skipped++;
      continue;
    }

    const already: boolean = await farmToken.isExcludedFromFee(addr);
    if (already) {
      console.log(`  ALREADY excluded  ${name} (${addr})`);
      skipped++;
      continue;
    }

    process.stdout.write(`  Excluding ${name} (${addr}) ... `);
    const tx = await farmToken.excludeFromFee(addr, true);
    await tx.wait();
    console.log(`✓  tx: ${tx.hash}`);
    excluded++;
  }

  console.log(`\nDone: ${excluded} excluded, ${skipped} skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
