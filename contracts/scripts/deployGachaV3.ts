/**
 * Deploy BanditDogFusion v3 (Soul Shard pity system + tokenizeDog).
 * Also redeployGuardDogNFT is NOT needed — we only updated BanditDogFusion.
 * GuardDogNFT already has the burnShard + updated mint functions baked in from this repo.
 * If GuardDogNFT was NOT redeployed (address is same), run setFusionContract only.
 *
 * Steps:
 *  1. Deploy new BanditDogFusion v3 with backendSigner
 *  2. Call GuardDogNFT.setFusionContract(v3Address) to grant mint/burn rights
 *  3. Print new address for .env update
 *
 * ⚠️  CODE FREEZE after this deploy — Sprint 4 = Security Audit.
 *      No further Smart Contract changes until post-audit sign-off.
 */
import { ethers, network } from 'hardhat';

const NFT_ADDRESS  = '0x67dd94bAb17F6584d409816fee1EDD5612e7caEa';
const FARM_ADDRESS = '0x7eaDD0273eb170B4ba28050F675C4878bEb75ae3';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer :', deployer.address);
  console.log('Balance  :', ethers.formatEther(balance), 'BNB');
  console.log('Network  :', network.name);

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient BNB — need at least 0.01 BNB for gas');
  }

  // 1. Deploy BanditDogFusion v3
  console.log('\nDeploying BanditDogFusion v3...');
  const BanditDogFusion = await ethers.getContractFactory('BanditDogFusion');
  const gacha = await BanditDogFusion.deploy(
    FARM_ADDRESS,
    NFT_ADDRESS,
    deployer.address,   // owner
    deployer.address,   // backendSigner = same as admin wallet (change to dedicated key for mainnet)
  );
  await gacha.waitForDeployment();
  const v3Address = await gacha.getAddress();
  console.log('BanditDogFusion v3 deployed:', v3Address);

  // 2. Grant mint + burnShard rights on GuardDogNFT
  console.log('\nSetting fusionContract on GuardDogNFT...');
  const nftAbi = [
    'function setFusionContract(address _fusion) external',
    'function fusionContract() view returns (address)',
  ];
  const nft = new ethers.Contract(NFT_ADDRESS, nftAbi, deployer);
  const tx = await nft.setFusionContract(v3Address);
  await tx.wait();
  const confirmed = await nft.fusionContract();
  console.log('setFusionContract done. tx:', tx.hash);
  console.log('Confirmed fusionContract:', confirmed);

  console.log('\n=== ✅ Update BOTH .env files with ===');
  console.log(`GACHA_CONTRACT_ADDRESS=${v3Address}`);
  console.log(`VITE_GACHA_CONTRACT_ADDRESS=${v3Address}`);
  console.log('\n=== ⚠️  CODE FREEZE — hand to Security Audit team for Sprint 4 ===');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
