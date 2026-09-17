import { ethers } from "hardhat";

const FARM_TOKEN = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
const NFT_CONTRACT = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";
const TREASURY_VAULT = "0xe59FfB05EdF59464e8803E81A4d790d828915006";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== DEPLOYING BanditDogFusion v4.2 ===");
  console.log("Deployer:", deployer.address);
  console.log("Deployer BNB:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. Deploy BanditDogFusion v4.2
  const FusionFactory = await ethers.getContractFactory("BanditDogFusion");
  console.log("Deploying contract...");
  const fusion = await FusionFactory.deploy(
    FARM_TOKEN,
    NFT_CONTRACT,
    deployer.address, // owner
    deployer.address  // backendSigner
  );
  await fusion.waitForDeployment();
  const fusionAddr = await fusion.getAddress();
  console.log("BanditDogFusion v4.2 deployed at:", fusionAddr);

  // 2. Set Treasury Address
  console.log("Setting Treasury Address to Vault:", TREASURY_VAULT);
  const txTreasury = await fusion.setTreasuryAddress(TREASURY_VAULT);
  await txTreasury.wait();
  console.log("Treasury set!");

  // 3. Authorize in GuardDogNFT
  console.log("Authorizing fusion contract in GuardDogNFT...");
  const nft = await ethers.getContractAt("GuardDogNFT", NFT_CONTRACT);
  const txAuth = await nft.setFusionContract(fusionAddr);
  await txAuth.wait();
  console.log("GuardDogNFT fusionContract updated to:", await nft.fusionContract());

  // 4. Verify config
  console.log("=== CONFIG VERIFICATION ===");
  console.log("goldenPullBnbFee:", ethers.formatEther(await fusion.goldenPullBnbFee()), "BNB");
  console.log("bulk10PullBnbFee:", ethers.formatEther(await fusion.bulk10PullBnbFee()), "BNB");
  console.log("forgeInsuranceFees T1:", ethers.formatEther(await fusion.forgeInsuranceFees(1)), "BNB");
  console.log("forgeInsuranceFees T2:", ethers.formatEther(await fusion.forgeInsuranceFees(2)), "BNB");
  console.log("forgeInsuranceFees T3:", ethers.formatEther(await fusion.forgeInsuranceFees(3)), "BNB");
  console.log("forgeInsuranceFees T4:", ethers.formatEther(await fusion.forgeInsuranceFees(4)), "BNB");

  console.log("\nDeployment & Setup completed successfully!");
  console.log("New Contract Address:", fusionAddr);
}

main().catch(console.error);
