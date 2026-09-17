import { ethers } from "hardhat";

const user = "0x348fde3b47ebae4ecb86365723d4239f6937af07";
const oldGachaAddr = "0x84BfC3Fc7cc9e223cc8ed690AFB32b060166af29";
const newGachaAddr = "0x5f0c3c5A4745c5EffAd7328AD93972f6474B4118";
const nftAddr = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";
const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const farm = await ethers.getContractAt("IERC20", farmAddr);
  console.log("Deployer FARM:", ethers.formatEther(await farm.balanceOf(deployer.address)));
  console.log("Deployer BNB:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("User:", user);
  const farmBal = await farm.balanceOf(user);
  console.log("User FARM balance:", ethers.formatEther(farmBal));

  const bnbBal = await ethers.provider.getBalance(user);
  console.log("User BNB balance:", ethers.formatEther(bnbBal));
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);

  const nft = await ethers.getContractAt("GuardDogNFT", nftAddr);
  console.log("GuardDogNFT fusionContract:", await nft.fusionContract());

  try {
    const oldGacha = await ethers.getContractAt("BanditDogFusion", oldGachaAddr);
    const oldPull = await oldGacha.pendingPulls(user);
    console.log("Old Gacha pendingPull:", {
      commitment: oldPull.commitment,
      commitBlock: oldPull.commitBlock.toString(),
      revealed: oldPull.revealed
    });
    console.log("Old Gacha pityCounter:", (await oldGacha.pityCounter(user)).toString());
  } catch (e: any) {
    console.log("Error querying old gacha:", e.message);
  }

  try {
    const newGacha = await ethers.getContractAt("BanditDogFusion", newGachaAddr);
    const newPull = await newGacha.pendingPulls(user);
    console.log("New Gacha pendingPull:", {
      commitment: newPull.commitment,
      commitBlock: newPull.commitBlock.toString(),
      revealed: newPull.revealed
    });
    console.log("New Gacha pityCounter:", (await newGacha.pityCounter(user)).toString());
  } catch (e: any) {
    console.log("Error querying new gacha:", e.message);
  }

  console.log("User NFTs:");
  for (let i = 1; i <= 6; i++) {
    const bal = await nft.balanceOf(user, i);
    if (bal > 0n) console.log(`  Breed ${i}:`, bal.toString());
  }
  const shards = await nft.balanceOf(user, 9999);
  console.log("  Soul Shards (9999):", shards.toString());
}

main().catch(console.error);
