/**
 * Deploy updated BanditDogFusion (v2) with tokenizeDog support.
 * All other contracts stay as-is — only Gacha is redeployed.
 *
 * Steps:
 *  1. Deploy new BanditDogFusion with backendSigner param
 *  2. Call GuardDogNFT.setFusionContract(newGachaAddress) to grant mint rights
 *  3. Print new address for .env update
 */
import { ethers, network } from 'hardhat';

const NFT_ADDRESS   = '0x6deDA9ab6107e70a74C8dEB284450F37Ec2e63E6';
const FARM_ADDRESS  = '0x7eaDD0273eb170B4ba28050F675C4878bEb75ae3';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'BNB');
  console.log('Network:', network.name);

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient BNB — need at least 0.01 BNB for gas');
  }

  // 1. Deploy new BanditDogFusion
  console.log('\nDeploying BanditDogFusion v2...');
  const BanditDogFusion = await ethers.getContractFactory('BanditDogFusion');
  const gacha = await BanditDogFusion.deploy(
    FARM_ADDRESS,
    NFT_ADDRESS,
    deployer.address,       // owner
    deployer.address,       // backendSigner = same as admin wallet
  );
  await gacha.waitForDeployment();
  const gachaAddress = await gacha.getAddress();
  console.log('BanditDogFusion v2 deployed:', gachaAddress);

  // 2. Authorize new Gacha to mint on GuardDogNFT
  console.log('\nAuthorizing new gacha on GuardDogNFT...');
  const nftAbi = ['function setFusionContract(address _fusion) external'];
  const nft = new ethers.Contract(NFT_ADDRESS, nftAbi, deployer);
  const tx = await nft.setFusionContract(gachaAddress);
  await tx.wait();
  console.log('setFusionContract done. tx:', tx.hash);

  console.log('\n=== Update .env & frontend/.env with ===');
  console.log(`GACHA_CONTRACT_ADDRESS=${gachaAddress}`);
  console.log(`VITE_GACHA_CONTRACT_ADDRESS=${gachaAddress}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
