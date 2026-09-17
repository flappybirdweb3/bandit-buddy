import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '../.env' });

const NFT_ADDRESS  = '0x67dd94bAb17F6584d409816fee1EDD5612e7caEa';
const FARM_ADDRESS = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
const TREASURY_BUYBACK_VAULT = '0xe59FfB05EdF59464e8803E81A4d790d828915006';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log('================================================================');
  console.log('DEPLOYING BNB TAX REVENUE ENGINE (AUTO-BUYBACK & BURN PIPELINE)');
  console.log('================================================================');
  console.log('Network                 :', network.name);
  console.log('Deployer                :', deployer.address);
  console.log('Deployer Balance        :', ethers.formatEther(balance), 'BNB');
  console.log('TreasuryBuyBack Vault   :', TREASURY_BUYBACK_VAULT);
  console.log('FarmToken               :', FARM_ADDRESS);
  console.log('GuardDogNFT             :', NFT_ADDRESS);

  if (balance < ethers.parseEther('0.02')) {
    throw new Error('Insufficient BNB for deployment gas (need at least 0.02 BNB)');
  }

  // ── 1. Deploy BarnServices (Subscriptions in BNB) ──────────────────────────
  console.log('\n[1/3] Deploying BarnServices (Premium Subscriptions in BNB)...');
  const BarnServicesFactory = await ethers.getContractFactory('BarnServices');
  const barnServices = await BarnServicesFactory.deploy(TREASURY_BUYBACK_VAULT, deployer.address);
  await barnServices.waitForDeployment();
  const barnServicesAddress = await barnServices.getAddress();
  console.log('✓ BarnServices deployed at:', barnServicesAddress);

  // ── 2. Deploy BanditDogFusion (Web2.5 Bridge + 0.002 BNB Fee) ──────────────
  console.log('\n[2/3] Deploying updated BanditDogFusion (with BNB Bridge Fee)...');
  const FusionFactory = await ethers.getContractFactory('BanditDogFusion');
  const fusion = await FusionFactory.deploy(
    FARM_ADDRESS,
    NFT_ADDRESS,
    deployer.address, // owner
    deployer.address  // backendSigner
  );
  await fusion.waitForDeployment();
  const fusionAddress = await fusion.getAddress();
  console.log('✓ BanditDogFusion deployed at:', fusionAddress);

  // Set Treasury Address on BanditDogFusion
  console.log('  -> Setting Treasury Vault address on BanditDogFusion...');
  const setTreasuryTx = await fusion.setTreasuryAddress(TREASURY_BUYBACK_VAULT);
  await setTreasuryTx.wait(1);
  console.log('  ✓ BanditDogFusion treasury set to:', TREASURY_BUYBACK_VAULT);

  // Grant mint + burnShard permissions on GuardDogNFT
  console.log('  -> Granting minting rights on GuardDogNFT...');
  const nftAbi = [
    'function setFusionContract(address _fusion) external',
    'function fusionContract() view returns (address)',
  ];
  const nft = new ethers.Contract(NFT_ADDRESS, nftAbi, deployer);
  const setFusionTx = await nft.setFusionContract(fusionAddress);
  await setFusionTx.wait(1);
  console.log('  ✓ GuardDogNFT fusionContract updated to:', fusionAddress);

  // ── 3. Deploy BanditMarket (P2P Market with BNB Trading & 3% Fee) ─────────
  console.log('\n[3/3] Deploying updated BanditMarket (P2P BNB Trading + 3% Vault Fee)...');
  const MarketFactory = await ethers.getContractFactory('BanditMarket');
  const market = await MarketFactory.deploy(
    FARM_ADDRESS,
    TREASURY_BUYBACK_VAULT, // platform fee routes to TreasuryBuyBack!
    deployer.address
  );
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log('✓ BanditMarket deployed at:', marketAddress);

  console.log('\n================================================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('================================================================');
  console.log(`BARN_SERVICES_ADDRESS=${barnServicesAddress}`);
  console.log(`GACHA_CONTRACT_ADDRESS=${fusionAddress}`);
  console.log(`MARKET_CONTRACT_ADDRESS=${marketAddress}`);
  console.log(`TREASURY_CONTRACT_ADDRESS=${TREASURY_BUYBACK_VAULT}`);

  // Write deployment result to a JSON file
  const deploymentRecord = {
    network: network.name,
    timestamp: new Date().toISOString(),
    barnServices: barnServicesAddress,
    gachaFusion: fusionAddress,
    market: marketAddress,
    treasuryVault: TREASURY_BUYBACK_VAULT,
    deployer: deployer.address,
  };

  fs.writeFileSync(
    path.join(__dirname, '../deployments/bnb-tax-engine.json'),
    JSON.stringify(deploymentRecord, null, 2)
  );
  console.log('✓ Saved deployment record to contracts/deployments/bnb-tax-engine.json');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
