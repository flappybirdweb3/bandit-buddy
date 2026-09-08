import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BNB');

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
    deployer.address, // signer = deployer (replace with a dedicated backend wallet in prod)
    deployer.address,
  );
  await claimContract.waitForDeployment();
  const claimAddress = await claimContract.getAddress();
  console.log('FarmTokenClaim deployed:', claimAddress);

  // 3. Deploy GuardDogNFT
  // treasury = deployer in dev; use a dedicated multisig in prod
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;
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

  // 4. Fund the claim pool with some initial tokens
  const poolAmount = ethers.parseUnits('100000', 18); // 100k FARM
  const approveTx = await farmToken.approve(claimAddress, poolAmount);
  await approveTx.wait(); // must be mined before fundPool reads the allowance
  console.log('Approve confirmed');
  const fundTx = await claimContract.fundPool(poolAmount);
  await fundTx.wait();
  console.log('Claim pool funded with 100,000 FARM');

  // Persist addresses for verify / admin scripts
  const deployment = {
    network: network.name,
    deployer: deployer.address,
    farmToken: farmTokenAddress,
    farmTokenClaim: claimAddress,
    guardDogNFT: nftAddress,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, '..', `deployment.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${outPath}`);

  console.log('\n=== Update .env with these addresses ===');
  console.log(`FARM_TOKEN_ADDRESS=${farmTokenAddress}`);
  console.log(`CLAIM_CONTRACT_ADDRESS=${claimAddress}`);
  console.log(`NFT_CONTRACT_ADDRESS=${nftAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
