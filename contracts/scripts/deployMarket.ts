/**
 * Re-deploy BanditMarket v2 only (keeps all other contracts unchanged).
 * Run: npx hardhat run scripts/deployMarket.ts --network bscTestnet
 *
 * After deploy, update .env:
 *   MARKET_CONTRACT_ADDRESS=<new address>
 *
 * Also update backend web3.service.ts ABI import if typechain-types changed.
 */
import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;
  const farmToken = process.env.FARM_TOKEN_ADDRESS;

  if (!farmToken) throw new Error('FARM_TOKEN_ADDRESS not set in .env');

  console.log('Network  :', network.name);
  console.log('Deployer :', deployer.address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BNB');
  console.log('FarmToken:', farmToken);
  console.log('Treasury :', treasury);

  const MarketF = await ethers.getContractFactory('BanditMarket');
  const market = await MarketF.deploy(farmToken, treasury, deployer.address);
  await market.waitForDeployment();

  const addr = await market.getAddress();
  console.log('\nBanditMarket v2 deployed:', addr);
  console.log('\n=== Update .env ===');
  console.log(`MARKET_CONTRACT_ADDRESS=${addr}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
