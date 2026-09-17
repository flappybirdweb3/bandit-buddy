/**
 * testSwap.ts — Trigger a real Swap event on FARM/WBNB pair to test DexVolumeService
 *
 * Sells 100 FARM for tBNB (swapExactTokensForETH)
 * Used to verify DexVolumeService tracks Swap events accurately.
 *
 * Usage:
 *   npx hardhat run scripts/testSwap.ts --network bscTestnet
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ROUTER_ABI = [
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
];

async function main() {
  if (network.name !== "bscTestnet") throw new Error(`Must run on bscTestnet, got: ${network.name}`);

  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployment.bscTestnet.json"), "utf-8"));
  const pairFile = path.join(__dirname, "../deployments/pair-bscTestnet.json");
  if (!fs.existsSync(pairFile)) throw new Error("Run createPairAndAddLiquidity.ts first");
  const pairData = JSON.parse(fs.readFileSync(pairFile, "utf-8"));

  const FARM = dep.farmToken;
  const ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
  const WBNB  = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

  const [deployer] = await ethers.getSigners();
  const swapAmount = ethers.parseUnits("100", 18); // 100 FARM

  console.log(`Network : ${network.name}`);
  console.log(`Pair    : ${pairData.pancakePair}`);
  console.log(`Swapping: 100 FARM → tBNB (address: ${deployer.address})`);

  const farm = new ethers.Contract(FARM, ERC20_ABI, deployer);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, deployer);

  // Approve router
  console.log("Step 1: Approve router...");
  await (await farm.approve(ROUTER, swapAmount)).wait();
  console.log("  Approved ✓");

  // Swap FARM → BNB
  console.log("Step 2: swapExactTokensForETH...");
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const tx = await router.swapExactTokensForETH(
    swapAmount,
    0n,                          // amountOutMin = 0 (testnet, slippage doesn't matter)
    [FARM, WBNB],
    deployer.address,
    deadline,
  );
  console.log(`  Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt?.blockNumber} ✓`);

  const bnb = await ethers.provider.getBalance(deployer.address);
  console.log(`\ntBNB balance after swap: ${ethers.formatEther(bnb)}`);
  console.log(`\nSwap event created! DexVolumeService will pick it up on next 5-min cron.`);
  console.log(`Tx on BSCScan: https://testnet.bscscan.com/tx/${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
