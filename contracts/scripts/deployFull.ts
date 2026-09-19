/**
 * deployFull.ts — V3 Tokenomics Complete Deployment
 *
 * Deploys and fully wires up the entire token distribution for BanditBuddy:
 *   • FarmVesting + FarmTokenSale (sale rounds)
 *   • addSchedule() for Team (13 members), Ecosystem, Treasury
 *   • setRoundTimes() for Angel / Private / Public
 *   • transfer 100M FARM to Liquidity Manager (for PancakeSwap LP)
 *   • lockTokens() call template for LiquidityLocker (run after LP creation)
 *
 * Usage:
 *   npx hardhat run scripts/deployFull.ts --network bscMainnet
 *   npx hardhat run scripts/deployFull.ts --network bscTestnet
 *
 * Prerequisites:
 *   - FarmToken already deployed
 *   - Admin wallet holds 1,000,000,000 FARM (full supply)
 *   - Admin wallet has enough BNB for gas (~0.05 BNB on mainnet)
 *   - LiquidityLocker already deployed (address in deployment JSON or env)
 *   - DEPLOYER_PRIVATE_KEY set in .env
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ─── Network-specific constants ──────────────────────────────────────────────

const USDT_ADDRESS: Record<string, string> = {
  bscMainnet: '0x55d398326f99059fF775485246999027B3197955',
  bscTestnet: '0x337610d27c682E347C9cD60BD4b3b107C9d34dD9',
};

// ─── V3 Tokenomics — wallet addresses ────────────────────────────────────────

// Treasury (Gnosis Safe 3/5 multisig) — receives USDT sale proceeds + 180M FARM
const TREASURY_WALLET = '0xB622a23F16DFFc40A782D5B71C50819C417a0fb5';

// Ecosystem hot wallet (backend drip-feed for P2E rewards)
const ECOSYSTEM_WALLET = '0xfdbA9c99698623f4b316dB2c48757cf04065FFc8';

// Liquidity Manager (creates PancakeSwap LP, then locks LP tokens)
const LIQUIDITY_WALLET = '0x36c2536bFE6229aa78D021756B8C191591103c83';

// Team members — total 150M FARM
// Leader 1: 51% = 76,500,000
// Leader 2: 10% = 15,000,000
// Marketing Leader: 9% = 13,500,000
// Remaining 10 members: 30% ÷ 10 = 4,500,000 each
const TEAM: Array<{ address: string; amount: bigint; label: string }> = [
  { address: '0xF64F910Ea216933e16824ee9A19De1B6c426A03a', amount: ethers.parseEther('76500000'), label: 'leader1' },
  { address: '0xA8F8DC270a4C40f24c2C2C0353c4BA8eaD0EDF2f', amount: ethers.parseEther('15000000'), label: 'leader2' },
  { address: '0x083CAd1B150926EB30a29f85f7473B2E0576f9A1', amount: ethers.parseEther('13500000'), label: 'mkt-leader' },
  { address: '0xc1EE347A5BED0a02B957295C39970D2472a4aB34', amount: ethers.parseEther('4500000'),  label: 'dev1' },
  { address: '0x367A882B89f404B41935fcA276afEA7E6B51bcb2', amount: ethers.parseEther('4500000'),  label: 'dev2' },
  { address: '0x46bD2bd2dF111CA915bBD5742Bbb1E4f663FC681', amount: ethers.parseEther('4500000'),  label: 'dev3' },
  { address: '0x5c995E60280b028631195D886b10D6B8A31Eb217', amount: ethers.parseEther('4500000'),  label: 'dev4' },
  { address: '0xA5298DE115635DCcAAecf57F5ade54D853fa67C4', amount: ethers.parseEther('4500000'),  label: 'dev5' },
  { address: '0xfF8a22c84e7Fa005127C23964985daDbc32A04D7', amount: ethers.parseEther('4500000'),  label: 'qa1' },
  { address: '0xA051Dc61887A9D1c8059Cb855a11D067fC4066B0', amount: ethers.parseEther('4500000'),  label: 'qa2' },
  { address: '0x517F455fE83764B3c13150fcf4D4DdAD61D9d357', amount: ethers.parseEther('4500000'),  label: 'sa' },
  { address: '0x9b0Ba955430b72e230C7a663b4D83722bab317C2', amount: ethers.parseEther('4500000'),  label: 'devops' },
  { address: '0x70Dd13610fbf7c9EC86386E64Bd1A5EAa5C6228e', amount: ethers.parseEther('4500000'),  label: 'bd-leader' },
];

// ─── V3 Sale timeline — Unix timestamps (Vietnam UTC+7) ──────────────────────
//
//   Angel   opens: 2026-10-22 09:15 VN  = 1792635300 UTC
//   Private opens: 2026-11-27 11:15 VN  = 1795752900 UTC  (36 days after Angel)
//   Public  opens: 2026-12-29 15:15 VN  = 1798532100 UTC  (32 days after Private)
//   Public  ends:  2027-01-28 15:15 VN  = 1801124100 UTC  (30 days after Public open)
//
//   TGE = PUBLIC_START (PancakeSwap listing happens when IDO opens)

const ANGEL_START   = 1792635300n;
const ANGEL_END     = 1795752899n; // 1 second before Private opens
const PRIVATE_START = 1795752900n;
const PRIVATE_END   = 1798532099n; // 1 second before Public opens
const PUBLIC_START  = 1798532100n;
const PUBLIC_END    = 1801124100n; // 30 days after Public open
const TGE_TIMESTAMP = PUBLIC_START; // listing = IDO open date

// ─── V3 Token distribution amounts ───────────────────────────────────────────

const SALE_FARM    = ethers.parseEther('170000000'); // 170M: Angel(50M)+Private(70M)+Public(50M)
const TEAM_FARM    = ethers.parseEther('150000000'); // 150M total, distributed per schedule
const ECOSYSTEM_FARM = ethers.parseEther('400000000'); // 400M
const TREASURY_FARM  = ethers.parseEther('180000000'); // 180M
const LIQUIDITY_FARM = ethers.parseEther('100000000'); // 100M — direct transfer, no vesting

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;
  const networkKey = network === 'unknown' ? 'bscTestnet' : network;

  console.log('\n════════════════════════════════════════════════════════');
  console.log(' BanditBuddy — V3 Full Deployment');
  console.log('════════════════════════════════════════════════════════');
  console.log(` Network:   ${networkKey}`);
  console.log(` Deployer:  ${deployer.address}`);
  console.log(` BNB balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`);

  // ── Load existing deployment info ──
  const depFile = path.join(__dirname, `../deployment.${networkKey}.json`);
  let dep: Record<string, unknown> = {};
  if (fs.existsSync(depFile)) dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));

  const FARM_ADDRESS = (dep['FarmToken'] as string | undefined) ?? process.env.FARM_TOKEN_ADDRESS;
  if (!FARM_ADDRESS) throw new Error('FarmToken address not found. Set FARM_TOKEN_ADDRESS env var or ensure deployment JSON exists.');

  const USDT_ADDR = USDT_ADDRESS[networkKey];
  if (!USDT_ADDR) throw new Error(`USDT address not configured for: ${networkKey}`);

  const farm = await ethers.getContractAt('IERC20', FARM_ADDRESS);
  const adminFarmBalance = await farm.balanceOf(deployer.address);
  const requiredFarm = SALE_FARM + TEAM_FARM + ECOSYSTEM_FARM + TREASURY_FARM + LIQUIDITY_FARM;
  console.log(` FARM balance: ${ethers.formatEther(adminFarmBalance)} FARM`);
  console.log(` Required:     ${ethers.formatEther(requiredFarm)} FARM`);
  if (adminFarmBalance < requiredFarm) {
    throw new Error(`Insufficient FARM. Have ${ethers.formatEther(adminFarmBalance)}, need ${ethers.formatEther(requiredFarm)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Deploy FarmVesting
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[1/8] Deploying FarmVesting...');
  const VestingFactory = await ethers.getContractFactory('FarmVesting');
  const farmVesting = await VestingFactory.deploy(FARM_ADDRESS, deployer.address);
  await farmVesting.waitForDeployment();
  const vestingAddr = await farmVesting.getAddress();
  console.log(`      FarmVesting: ${vestingAddr}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Deploy FarmTokenSale
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[2/8] Deploying FarmTokenSale...');
  const SaleFactory = await ethers.getContractFactory('FarmTokenSale');
  const farmTokenSale = await SaleFactory.deploy(
    USDT_ADDR,
    FARM_ADDRESS,
    vestingAddr,
    TREASURY_WALLET,  // USDT sale proceeds go to Gnosis Safe
    deployer.address,
  );
  await farmTokenSale.waitForDeployment();
  const saleAddr = await farmTokenSale.getAddress();
  console.log(`      FarmTokenSale: ${saleAddr}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Grant CREATOR_ROLE on FarmVesting to FarmTokenSale
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[3/8] Granting CREATOR_ROLE to FarmTokenSale...');
  const CREATOR_ROLE = await farmVesting.CREATOR_ROLE();
  await (await farmVesting.grantRole(CREATOR_ROLE, saleAddr)).wait();
  console.log('      Done.');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Fund FarmTokenSale with 170M FARM (sale allocations)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[4/8] Funding FarmTokenSale with 170M FARM...');
  await (await farm.transfer(saleAddr, SALE_FARM)).wait();
  console.log(`      Transferred ${ethers.formatEther(SALE_FARM)} FARM to FarmTokenSale.`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Set sale round times
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[5/8] Setting sale round times...');

  await (await farmTokenSale.setRoundTimes(0, ANGEL_START,   ANGEL_END)).wait();
  console.log(`      Angel:   ${new Date(Number(ANGEL_START)   * 1000).toISOString()} → ${new Date(Number(ANGEL_END)   * 1000).toISOString()}`);

  await (await farmTokenSale.setRoundTimes(1, PRIVATE_START, PRIVATE_END)).wait();
  console.log(`      Private: ${new Date(Number(PRIVATE_START) * 1000).toISOString()} → ${new Date(Number(PRIVATE_END) * 1000).toISOString()}`);

  await (await farmTokenSale.setRoundTimes(2, PUBLIC_START,  PUBLIC_END)).wait();
  console.log(`      Public:  ${new Date(Number(PUBLIC_START)  * 1000).toISOString()} → ${new Date(Number(PUBLIC_END)  * 1000).toISOString()}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: Set TGE timestamp on FarmVesting
  //   TGE = Public round open = PancakeSwap listing date
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[6/8] Setting TGE timestamp on FarmVesting...');
  await (await farmVesting.setTge(TGE_TIMESTAMP)).wait();
  console.log(`      TGE set: ${new Date(Number(TGE_TIMESTAMP) * 1000).toISOString()} (${TGE_TIMESTAMP})`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: Create vesting schedules — Team, Ecosystem, Treasury
  //
  //   All schedules are created by the deployer (admin) directly on FarmVesting.
  //   The deployer already has DEFAULT_ADMIN_ROLE; grant CREATOR_ROLE to self.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[7/8] Creating vesting schedules...');

  // Grant CREATOR_ROLE to deployer so we can call addSchedule directly
  await (await farmVesting.grantRole(CREATOR_ROLE, deployer.address)).wait();

  // ── 7a. Transfer FARM to vesting contract ──
  const vestingFarm = TEAM_FARM + ECOSYSTEM_FARM + TREASURY_FARM;
  await (await farm.transfer(vestingAddr, vestingFarm)).wait();
  console.log(`      Transferred ${ethers.formatEther(vestingFarm)} FARM to FarmVesting.`);

  // ── 7b. Team schedules: 2% TGE | 180d cliff | 720d linear ──
  console.log('\n      Team schedules (2% TGE | 180d cliff | 720d linear):');
  let teamTotal = 0n;
  for (const member of TEAM) {
    await (await farmVesting.addSchedule(
      member.address,
      member.amount,
      200,   // 2% TGE
      180,   // 180-day cliff
      720,   // 720-day linear vesting (24 months)
      `team-${member.label}`,
    )).wait();
    teamTotal += member.amount;
    console.log(`        ${member.label.padEnd(12)} ${member.address}  ${ethers.formatEther(member.amount)} FARM`);
  }
  console.log(`      Team total: ${ethers.formatEther(teamTotal)} FARM`);

  // ── 7c. Ecosystem schedule: 5% TGE | 0d cliff | 1080d linear ──
  console.log('\n      Ecosystem schedule (5% TGE | 0d cliff | 1080d linear):');
  await (await farmVesting.addSchedule(
    ECOSYSTEM_WALLET,
    ECOSYSTEM_FARM,
    500,   // 5% TGE = 20M FARM
    0,     // no cliff
    1080,  // 36 months linear
    'ecosystem',
  )).wait();
  console.log(`        ${ECOSYSTEM_WALLET}  ${ethers.formatEther(ECOSYSTEM_FARM)} FARM`);

  // ── 7d. Treasury schedule: 10% TGE | 30d cliff | 720d linear ──
  console.log('\n      Treasury schedule (10% TGE | 30d cliff | 720d linear):');
  await (await farmVesting.addSchedule(
    TREASURY_WALLET,
    TREASURY_FARM,
    1000,  // 10% TGE = 18M FARM
    30,    // 30-day cliff
    720,   // 24 months linear
    'treasury',
  )).wait();
  console.log(`        ${TREASURY_WALLET}  ${ethers.formatEther(TREASURY_FARM)} FARM`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8: Transfer Liquidity allocation to Liquidity Manager
  //   100M FARM sent directly — Liquidity Manager will create PancakeSwap LP
  //   and then lock LP tokens via LiquidityLocker.sol (minimum 12 months)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[8/8] Transferring 100M FARM to Liquidity Manager...');
  await (await farm.transfer(LIQUIDITY_WALLET, LIQUIDITY_FARM)).wait();
  console.log(`      Transferred ${ethers.formatEther(LIQUIDITY_FARM)} FARM to ${LIQUIDITY_WALLET}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Post-deploy verification
  // ─────────────────────────────────────────────────────────────────────────
  const saleBalance    = await farm.balanceOf(saleAddr);
  const vestingBalance = await farm.balanceOf(vestingAddr);
  const liqBalance     = await farm.balanceOf(LIQUIDITY_WALLET);
  const adminRemaining = await farm.balanceOf(deployer.address);
  const totalAllocated = await farmVesting.totalAllocated();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' BALANCES AFTER DEPLOY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` FarmTokenSale (sale rounds): ${ethers.formatEther(saleBalance)} FARM`);
  console.log(` FarmVesting (team+eco+tsy):  ${ethers.formatEther(vestingBalance)} FARM`);
  console.log(` FarmVesting.totalAllocated:  ${ethers.formatEther(totalAllocated)} FARM`);
  console.log(` Liquidity Manager:           ${ethers.formatEther(liqBalance)} FARM`);
  console.log(` Admin remaining:             ${ethers.formatEther(adminRemaining)} FARM`);

  const expectedSale    = SALE_FARM;
  const expectedVesting = TEAM_FARM + ECOSYSTEM_FARM + TREASURY_FARM;
  const ok = saleBalance === expectedSale
          && vestingBalance === expectedVesting
          && liqBalance >= LIQUIDITY_FARM;
  console.log(` Balance check: ${ok ? 'PASS' : 'FAIL — review above'}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Save deployment info
  // ─────────────────────────────────────────────────────────────────────────
  const result = {
    ...dep,
    FarmVesting:       vestingAddr,
    FarmTokenSale:     saleAddr,
    deployedBy:        deployer.address,
    deployedAt:        new Date().toISOString(),
    network:           networkKey,
    tgeTimestamp:      TGE_TIMESTAMP.toString(),
    roundTimes: {
      angel:   { start: ANGEL_START.toString(),   end: ANGEL_END.toString() },
      private: { start: PRIVATE_START.toString(), end: PRIVATE_END.toString() },
      public:  { start: PUBLIC_START.toString(),  end: PUBLIC_END.toString() },
    },
    wallets: {
      treasury:         TREASURY_WALLET,
      ecosystem:        ECOSYSTEM_WALLET,
      liquidityManager: LIQUIDITY_WALLET,
    },
    postDeployChecklist: [
      '[ ] addToWhitelist(0, [...]) — Angel round whitelist',
      '[ ] addToWhitelist(1, [...]) — Private round whitelist',
      '[ ] Liquidity Manager: create PancakeSwap LP with 100M FARM + USDT pair',
      '[ ] Liquidity Manager: call LiquidityLocker.lockTokens(lpToken, amount, 365 days, TREASURY_WALLET)',
      '[ ] Publish LP lock TX hash in Whitepaper (anti-rug proof)',
      '[ ] Backend: set up daily cron to call farmVesting.release(ECOSYSTEM_WALLET)',
      '[ ] Monitor alert: notify if ecosystem wallet FARM balance < 1,000,000',
    ],
  };

  fs.writeFileSync(depFile, JSON.stringify(result, null, 2));
  console.log(`\n Deployment info saved to ${depFile}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' POST-DEPLOY CHECKLIST');
  console.log('═══════════════════════════════════════════════════════════');
  for (const item of result.postDeployChecklist) {
    console.log(` ${item}`);
  }
  console.log('\n FarmVesting:   ', vestingAddr);
  console.log(' FarmTokenSale: ', saleAddr);
  console.log(' TGE:           ', new Date(Number(TGE_TIMESTAMP) * 1000).toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
