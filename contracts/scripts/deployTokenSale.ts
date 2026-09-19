/**
 * Deploy script: FarmVesting + FarmTokenSale
 *
 * Usage:
 *   npx hardhat run scripts/deployTokenSale.ts --network bscTestnet
 *   npx hardhat run scripts/deployTokenSale.ts --network bscMainnet
 *
 * Prerequisites:
 *   - FARM token already deployed (address in deployment.bscTestnet.json or env)
 *   - USDT address known for target network
 *   - Admin wallet has enough FARM to fund sale allocations (120M = Angel 50M + Private 70M)
 *     plus Public 50M = 170M FARM total
 *   - Admin wallet has BNB for gas
 *
 * Post-deploy steps (manual):
 *   1. Grant CREATOR_ROLE to FarmTokenSale on FarmVesting
 *   2. Transfer 170M FARM to FarmTokenSale (for sale rounds)
 *   3. setRoundTimes() for each round
 *   4. addToWhitelist() for Angel and Private rounds
 *   5. When TGE: call FarmVesting.setTge(tgeTimestamp)
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const USDT: Record<string, string> = {
  bscTestnet: '0x337610d27C682e347c9cD60bD4b3B107c9D34dD9', // Binance-peg USDT testnet
  bscMainnet: '0x55d398326f99059fF775485246999027B3197955', // Binance-peg USDT mainnet
};

// FARM amounts to pre-fund FarmTokenSale (must approve from admin wallet)
const SALE_FARM_AMOUNT = ethers.parseEther('170000000'); // 170M: Angel(50M)+Private(70M)+Public(50M)

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;
  console.log(`\nDeploying on ${network} with deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`);

  // ── Read existing deployment info ──
  const depFile = path.join(__dirname, `../deployment.bscTestnet.json`);
  let depInfo: Record<string, string> = {};
  if (fs.existsSync(depFile)) {
    depInfo = JSON.parse(fs.readFileSync(depFile, 'utf8'));
  }

  const FARM_ADDRESS = depInfo['farmToken'] ?? depInfo['FarmToken'] ?? process.env.FARM_TOKEN_ADDRESS;
  if (!FARM_ADDRESS) throw new Error('FARM_TOKEN_ADDRESS not set in deployment file or env');

  const USDT_ADDRESS = USDT[network === 'unknown' ? 'bscTestnet' : network];
  if (!USDT_ADDRESS) throw new Error(`USDT address not configured for network: ${network}`);

  const TREASURY = deployer.address; // admin wallet collects USDT by default
  console.log(`FARM:     ${FARM_ADDRESS}`);
  console.log(`USDT:     ${USDT_ADDRESS}`);
  console.log(`Treasury: ${TREASURY}\n`);

  // ── 1. Deploy FarmVesting ──
  console.log('1. Deploying FarmVesting...');
  const FarmVesting = await ethers.getContractFactory('FarmVesting');
  const farmVesting = await FarmVesting.deploy(FARM_ADDRESS, deployer.address);
  await farmVesting.waitForDeployment();
  const vestingAddr = await farmVesting.getAddress();
  console.log(`   FarmVesting: ${vestingAddr}`);

  // ── 2. Deploy FarmTokenSale ──
  console.log('2. Deploying FarmTokenSale...');
  const FarmTokenSale = await ethers.getContractFactory('FarmTokenSale');
  const farmTokenSale = await FarmTokenSale.deploy(
    USDT_ADDRESS,
    FARM_ADDRESS,
    vestingAddr,
    TREASURY,
    deployer.address,
  );
  await farmTokenSale.waitForDeployment();
  const saleAddr = await farmTokenSale.getAddress();
  console.log(`   FarmTokenSale: ${saleAddr}`);

  // ── 3. Grant CREATOR_ROLE on FarmVesting to FarmTokenSale ──
  console.log('3. Granting CREATOR_ROLE to FarmTokenSale on FarmVesting...');
  const CREATOR_ROLE = await farmVesting.CREATOR_ROLE();
  const tx3 = await farmVesting.grantRole(CREATOR_ROLE, saleAddr);
  await tx3.wait();
  console.log(`   Done. TxHash: ${tx3.hash}`);

  // ── 4. Fund FarmTokenSale with FARM tokens ──
  console.log(`4. Transferring ${ethers.formatEther(SALE_FARM_AMOUNT)} FARM to FarmTokenSale...`);
  const farm = await ethers.getContractAt('IERC20', FARM_ADDRESS);
  const adminBalance = await farm.balanceOf(deployer.address);
  if (adminBalance < SALE_FARM_AMOUNT) {
    console.warn(`   WARNING: Admin FARM balance (${ethers.formatEther(adminBalance)}) < required (${ethers.formatEther(SALE_FARM_AMOUNT)})`);
    console.warn('   Skipping FARM transfer. Fund manually before opening rounds.');
  } else {
    const tx4 = await farm.transfer(saleAddr, SALE_FARM_AMOUNT);
    await tx4.wait();
    console.log(`   Done. TxHash: ${tx4.hash}`);
  }

  // ── 5. (Optional) Set round times for quick testnet testing ──
  //    Uncomment to auto-set all rounds starting from now
  /*
  const now = Math.floor(Date.now() / 1000);
  const ONE_MONTH = 30 * 24 * 3600;

  console.log('5. Setting round times...');
  await (await farmTokenSale.setRoundTimes(0, now, now + ONE_MONTH)).wait();          // Angel: now → +30d
  await (await farmTokenSale.setRoundTimes(1, now + ONE_MONTH, now + 2 * ONE_MONTH)).wait(); // Private: +30d → +60d
  await (await farmTokenSale.setRoundTimes(2, now + 2 * ONE_MONTH, now + 3 * ONE_MONTH)).wait(); // Public: +60d → +90d
  console.log('   Round times set.');
  */

  // ── 6. Save deployment info ──
  const timestamp = new Date().toISOString();
  const result = {
    ...depInfo,
    FarmVesting:    vestingAddr,
    FarmTokenSale:  saleAddr,
    deployedBy:     deployer.address,
    deployedAt:     timestamp,
    network,
    vestingNotes: {
      tgeTimestamp: 'NOT SET — call farmVesting.setTge(unixTimestamp) at TGE',
      creatorRole:  `granted to FarmTokenSale (${saleAddr})`,
    },
    saleNotes: {
      roundTimes: 'NOT SET — call farmTokenSale.setRoundTimes(roundId, start, end) per round',
      whitelist:  'Angel + Private require whitelist — call addToWhitelist(roundId, [addresses])',
      farmFunded: adminBalance >= SALE_FARM_AMOUNT ? `${ethers.formatEther(SALE_FARM_AMOUNT)} FARM` : 'NOT FUNDED — transfer manually',
    },
  };
  fs.writeFileSync(depFile, JSON.stringify(result, null, 2));
  console.log(`\n✓ Deployment info saved to ${depFile}`);

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' DEPLOYMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(` FarmVesting:   ${vestingAddr}`);
  console.log(` FarmTokenSale: ${saleAddr}`);
  console.log('\n POST-DEPLOY CHECKLIST:');
  console.log(' [ ] setRoundTimes(0, start, end)  — Angel round');
  console.log(' [ ] setRoundTimes(1, start, end)  — Private round');
  console.log(' [ ] setRoundTimes(2, start, end)  — Public round');
  console.log(' [ ] addToWhitelist(0, [...])       — Angel whitelist');
  console.log(' [ ] addToWhitelist(1, [...])       — Private whitelist');
  console.log(' [ ] At TGE: farmVesting.setTge(unixTimestamp)');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
