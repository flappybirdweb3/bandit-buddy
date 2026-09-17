import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  const vaultAddr = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
  const TreasuryFactory = await ethers.getContractFactory("TreasuryBuyBack");
  const vault = TreasuryFactory.attach(vaultAddr).connect(signer) as any;

  console.log("Current threshold:", ethers.formatEther(await vault.buyBackThreshold()), "BNB");
  console.log("Updating threshold to 2.0 BNB on BSC Testnet...");
  const tx = await vault.setBuyBackThreshold(ethers.parseEther("2.0"), { gasLimit: 100000 });
  console.log("Tx hash:", tx.hash);
  await tx.wait(1);
  console.log("New threshold on-chain:", ethers.formatEther(await vault.buyBackThreshold()), "BNB");
}

main().catch(console.error);
