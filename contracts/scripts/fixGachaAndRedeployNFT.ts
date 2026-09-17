import { ethers } from 'hardhat';

const GACHA_ADDRESS    = '0x07Bb6A77D429DeF6438B227312DcEdd10dA1351E';
const FARM_ADDRESS     = '0x7eaDD0273eb170B4ba28050F675C4878bEb75ae3';
const TREASURY_ADDRESS = '0xc93A925789e82238B884D7537D86364E73D5F7C1';
const USER_WALLET      = '0x348fde3b47ebae4ecb86365723d4239f6937af07';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer Balance:', ethers.formatEther(bal), 'BNB');

  // 1. Deploy new GuardDogNFT with Soul Shard (9999) and burnShard support
  console.log('\n--- 1. Deploying new GuardDogNFT ---');
  const GuardDogNFT = await ethers.getContractFactory('GuardDogNFT');
  const newNFT = await GuardDogNFT.deploy(
    FARM_ADDRESS,
    deployer.address,
    TREASURY_ADDRESS,
    'https://cdn.example/dogs/'
  );
  await newNFT.waitForDeployment();
  const newNftAddr = await newNFT.getAddress();
  console.log('New GuardDogNFT deployed at:', newNftAddr);

  // 2. Configure new GuardDogNFT: set fusionContract = GACHA_ADDRESS
  console.log('\n--- 2. Setting fusionContract on new GuardDogNFT ---');
  let tx = await newNFT.setFusionContract(GACHA_ADDRESS);
  await tx.wait();
  console.log('setFusionContract done:', tx.hash);

  // 3. Configure Gacha (BanditDogFusion): setNftContract = newNftAddr
  console.log('\n--- 3. Updating nftContract on BanditDogFusion ---');
  const gachaAbi = [
    'function setNftContract(address _nft) external',
    'function nftContract() view returns (address)',
    'function pullCost() view returns (uint256)'
  ];
  const gacha = new ethers.Contract(GACHA_ADDRESS, gachaAbi, deployer);
  tx = await gacha.setNftContract(newNftAddr);
  await tx.wait();
  console.log('gacha.setNftContract done:', tx.hash);
  const confirmedNft = await gacha.nftContract();
  console.log('Confirmed Gacha nftContract:', confirmedNft);

  // 4. Migrate user NFT: Mint Token 4 (Epic Rottweiler) to USER_WALLET
  console.log('\n--- 4. Minting Token 4 (Epic Rottweiler) to user ---');
  tx = await newNFT.mintTo(USER_WALLET, 4, 1);
  await tx.wait();
  console.log('mintTo Token 4 done:', tx.hash);

  // 5. Transfer 50 $FARM to user as refund for the failed pull
  console.log('\n--- 5. Refunding 50 $FARM to user ---');
  const erc20Abi = [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)'
  ];
  const farm = new ethers.Contract(FARM_ADDRESS, erc20Abi, deployer);
  tx = await farm.transfer(USER_WALLET, ethers.parseUnits('50', 18));
  await tx.wait();
  console.log('Refund 50 FARM done:', tx.hash);

  // 6. Test minting Soul Shard 9999 to verify it works on-chain
  console.log('\n--- 6. Test minting Soul Shard 9999 ---');
  tx = await newNFT.mintTo(deployer.address, 9999, 1);
  await tx.wait();
  console.log('mintTo Soul Shard (9999) succeeded:', tx.hash);

  console.log('\n================ SUCCESS ================');
  console.log('NEW NFT_CONTRACT_ADDRESS =', newNftAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
