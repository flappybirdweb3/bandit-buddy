/**
 * Deploy BanditDogFusion v4 (Soul Forge & Dog Fusion + Gacha + Pity Shards).
 *
 * Steps:
 *  1. Deploy new BanditDogFusion v4 with backendSigner
 *  2. Call GuardDogNFT.setFusionContract(v4Address) to grant mint/burn rights
 *  3. Print new address for .env update
 */
import { ethers, network } from 'hardhat';

const NFT_ADDRESS  = '0x67dd94bAb17F6584d409816fee1EDD5612e7caEa';
const FARM_ADDRESS = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer :', deployer.address);
  console.log('Balance  :', ethers.formatEther(balance), 'BNB');
  console.log('Network  :', network.name);

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient BNB — need at least 0.01 BNB for gas');
  }

  // 1. Deploy BanditDogFusion v4
  console.log('\nDeploying BanditDogFusion v4 (Soul Forge)...');
  const BanditDogFusion = await ethers.getContractFactory('BanditDogFusion');
  const gacha = await BanditDogFusion.deploy(
    FARM_ADDRESS,
    NFT_ADDRESS,
    deployer.address,   // owner
    deployer.address,   // backendSigner / oracle
  );
  await gacha.waitForDeployment();
  const v4Address = await gacha.getAddress();
  console.log('BanditDogFusion v4 deployed:', v4Address);

  // 2. Grant mint + burnShard rights on GuardDogNFT
  console.log('\nSetting fusionContract on GuardDogNFT...');
  const nftAbi = [
    'function setFusionContract(address _fusion) external',
    'function fusionContract() view returns (address)',
  ];
  const nft = new ethers.Contract(NFT_ADDRESS, nftAbi, deployer);
  const tx = await nft.setFusionContract(v4Address);
  await tx.wait();
  const confirmed = await nft.fusionContract();
  console.log('setFusionContract done. tx:', tx.hash);
  console.log('Confirmed fusionContract:', confirmed);

  console.log('\n=== ✅ Update BOTH .env files with ===');
  console.log(`GACHA_CONTRACT_ADDRESS=${v4Address}`);
  console.log(`VITE_GACHA_CONTRACT_ADDRESS=${v4Address}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
