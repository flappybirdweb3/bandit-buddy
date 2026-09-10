import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// BSC Testnet PancakeSwap V2 Router
const PANCAKE_ROUTER_TESTNET = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';
const PANCAKE_ROUTER_MAINNET = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB_TESTNET           = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';
const WBNB_MAINNET           = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BNB');
  console.log('Network:', network.name);

  const isMainnet = network.name === 'bscMainnet';
  const pancakeRouter = isMainnet ? PANCAKE_ROUTER_MAINNET : PANCAKE_ROUTER_TESTNET;
  const wbnb          = isMainnet ? WBNB_MAINNET           : WBNB_TESTNET;
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;

  // 1. Deploy FarmToken
  const FarmToken = await ethers.getContractFactory('FarmToken');
  const farmToken = await FarmToken.deploy(deployer.address);
  await farmToken.waitForDeployment();
  const farmTokenAddress = await farmToken.getAddress();
  console.log('FarmToken deployed:', farmTokenAddress);

  // 2. Deploy FarmTokenClaim
  const FarmTokenClaim = await ethers.getContractFactory('FarmTokenClaim');
  const claimContract = await FarmTokenClaim.deploy(
    farmTokenAddress,
    deployer.address, // signer = deployer backend wallet
    deployer.address,
  );
  await claimContract.waitForDeployment();
  const claimAddress = await claimContract.getAddress();
  console.log('FarmTokenClaim deployed:', claimAddress);

  // 3. Deploy GuardDogNFT
  const GuardDogNFT = await ethers.getContractFactory('GuardDogNFT');
  const nftContract = await GuardDogNFT.deploy(
    farmTokenAddress,
    deployer.address,
    treasury,
    'https://api.barnbuddy.io/nft/metadata/',
  );
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  console.log('GuardDogNFT deployed:', nftAddress);

  // 4. Deploy BanditMarket
  const BanditMarket = await ethers.getContractFactory('BanditMarket');
  const marketContract = await BanditMarket.deploy(
    farmTokenAddress,
    treasury,
    deployer.address,
  );
  await marketContract.waitForDeployment();
  const marketAddress = await marketContract.getAddress();
  console.log('BanditMarket deployed:', marketAddress);

  // 5. Deploy TreasuryBuyBack
  const TreasuryBuyBack = await ethers.getContractFactory('TreasuryBuyBack');
  const treasuryContract = await TreasuryBuyBack.deploy(
    farmTokenAddress,
    pancakeRouter,
    wbnb,
    deployer.address,
  );
  await treasuryContract.waitForDeployment();
  const treasuryAddress = await treasuryContract.getAddress();
  console.log('TreasuryBuyBack deployed:', treasuryAddress);

  // 6. Deploy BanditDogFusion
  const BanditDogFusion = await ethers.getContractFactory('BanditDogFusion');
  const gachaContract = await BanditDogFusion.deploy(
    farmTokenAddress,
    nftAddress,
    deployer.address,
  );
  await gachaContract.waitForDeployment();
  const gachaAddress = await gachaContract.getAddress();
  console.log('BanditDogFusion deployed:', gachaAddress);

  // 7. Deploy GuildStaking
  const GuildStaking = await ethers.getContractFactory('GuildStaking');
  const guildStakingContract = await GuildStaking.deploy(
    farmTokenAddress,
    deployer.address,
  );
  await guildStakingContract.waitForDeployment();
  const guildStakingAddress = await guildStakingContract.getAddress();
  console.log('GuildStaking deployed:', guildStakingAddress);

  // 8. Fund the claim pool with initial tokens
  const poolAmount = ethers.parseUnits('100000', 18); // 100k FARM
  const approveTx = await farmToken.approve(claimAddress, poolAmount);
  await approveTx.wait();
  const fundTx = await claimContract.fundPool(poolAmount);
  await fundTx.wait();
  console.log('Claim pool funded with 100,000 FARM');

  // 9. Grant BanditDogFusion minting rights on GuardDogNFT
  // (GuardDogNFT needs a mint() function — add grantFusionRole below or use owner mint)
  console.log('Note: Grant BanditDogFusion mint rights on GuardDogNFT via setFusionContract()');

  // Persist addresses
  const deployment = {
    network: network.name,
    deployer: deployer.address,
    farmToken: farmTokenAddress,
    farmTokenClaim: claimAddress,
    guardDogNFT: nftAddress,
    banditMarket: marketAddress,
    treasuryBuyBack: treasuryAddress,
    banditDogFusion: gachaAddress,
    guildStaking: guildStakingAddress,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, '..', `deployment.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${outPath}`);

  console.log('\n=== Update .env with these addresses ===');
  console.log(`FARM_TOKEN_ADDRESS=${farmTokenAddress}`);
  console.log(`CLAIM_CONTRACT_ADDRESS=${claimAddress}`);
  console.log(`NFT_CONTRACT_ADDRESS=${nftAddress}`);
  console.log(`MARKET_CONTRACT_ADDRESS=${marketAddress}`);
  console.log(`TREASURY_CONTRACT_ADDRESS=${treasuryAddress}`);
  console.log(`GACHA_CONTRACT_ADDRESS=${gachaAddress}`);
  console.log(`GUILD_STAKING_ADDRESS=${guildStakingAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
