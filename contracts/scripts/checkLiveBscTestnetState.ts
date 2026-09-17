import { ethers } from "hardhat";

async function main() {
  console.log("=== LIVE BSC TESTNET (CHAIN ID 97) STATE CHECK ===");
  const fusionAddr = "0x8fdD78C87793084384257fe14Fe448E12220e9d6";
  const vaultAddr = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
  const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
  const deadAddr = "0x000000000000000000000000000000000000dEaD";

  const fusion = await ethers.getContractAt("BanditDogFusion", fusionAddr);
  const treasury = await ethers.getContractAt("TreasuryBuyBack", vaultAddr);
  const farm = await ethers.getContractAt("IERC20", farmAddr);

  const vaultBnb = await ethers.provider.getBalance(vaultAddr);
  const fusionBnb = await ethers.provider.getBalance(fusionAddr);
  const jackpotPool = await fusion.jackpotPoolBnb();
  const threshold = await treasury.buyBackThreshold();
  const deadFarm = await farm.balanceOf(deadAddr);
  const totalBurned = await treasury.totalBurned();

  console.log("Treasury Vault Balance :", ethers.formatEther(vaultBnb), "BNB");
  console.log("Treasury Buyback Target:", ethers.formatEther(threshold), "BNB");
  console.log("BanditDogFusion Balance:", ethers.formatEther(fusionBnb), "BNB");
  console.log("Jackpot Pool Reserve   :", ethers.formatEther(jackpotPool), "BNB");
  console.log("Dead Address FARM Bal  :", ethers.formatEther(deadFarm), "FARM");
  console.log("Cumulative Total Burned:", ethers.formatEther(totalBurned), "FARM");
}

main().catch(console.error);
