import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=================================================");
  console.log("TESTING VAULT & BUYBACK $FARM -> BURN ON BSC TESTNET");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer / Admin address:", deployer.address);
  const balanceBefore = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer BNB balance:", ethers.formatEther(balanceBefore));

  const farmTokenAddress = "0xB10067A034078E3FC8335Fb003eEF7334C44952f"; // FarmToken V2
  const routerAddress    = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"; // PancakeSwap V2 Router
  const wbnbAddress      = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"; // WBNB
  const usdtAddress      = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"; // BSC Testnet USDT
  const DEAD_ADDRESS     = "0x000000000000000000000000000000000000dEaD";

  // 1. Deploy the upgraded TreasuryBuyBack contract
  console.log("\n[Step 1] Deploying TreasuryBuyBack contract...");
  const TreasuryFactory = await ethers.getContractFactory("TreasuryBuyBack");
  const treasury = await TreasuryFactory.deploy(
    farmTokenAddress,
    routerAddress,
    wbnbAddress,
    usdtAddress,
    deployer.address
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✓ TreasuryBuyBack deployed at:", treasuryAddress);

  // 2. Set buyback threshold to 0.002 BNB for live testing
  console.log("\n[Step 2] Setting buyBackThreshold to 0.002 BNB for testnet verification...");
  const setThresholdTx = await treasury.setBuyBackThreshold(ethers.parseEther("0.002"));
  await setThresholdTx.wait();
  console.log("✓ buyBackThreshold set to:", ethers.formatEther(await treasury.buyBackThreshold()), "BNB");

  // 3. Configure FarmTokenV2 to route taxes to this TreasuryBuyBack vault
  console.log("\n[Step 3] Configuring FarmTokenV2 treasuryBuybackPool...");
  const farmAbi = [
    "function setTreasuryBuybackPool(address) external",
    "function treasuryBuybackPool() view returns (address)",
    "function excludeFromFee(address, bool) external",
    "function isExcludedFromFee(address) view returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function pancakePair() view returns (address)"
  ];
  const farmToken = new ethers.Contract(farmTokenAddress, farmAbi, deployer);
  const setPoolTx = await farmToken.setTreasuryBuybackPool(treasuryAddress);
  await setPoolTx.wait();
  console.log("✓ FarmTokenV2 treasuryBuybackPool is now:", await farmToken.treasuryBuybackPool());

  // Exclude Treasury contract from fee so burn transfers aren't taxed
  const excludeTx = await farmToken.excludeFromFee(treasuryAddress, true);
  await excludeTx.wait();
  console.log("✓ Treasury excluded from fee:", await farmToken.isExcludedFromFee(treasuryAddress));

  // 4. Test The Vault: Send 0.003 BNB into the Treasury contract
  console.log("\n[Step 4] Testing Vault: Depositing 0.003 BNB into Treasury...");
  const fundTx = await deployer.sendTransaction({
    to: treasuryAddress,
    value: ethers.parseEther("0.003"),
  });
  await fundTx.wait();
  const vaultBnbBalance = await ethers.provider.getBalance(treasuryAddress);
  console.log("✓ Vault BNB Balance:", ethers.formatEther(vaultBnbBalance), "BNB");
  console.log("✓ Vault received funds successfully!");

  // 5. Check Dead Address FARM balance before BuyBack & Burn
  const deadBalBefore = await farmToken.balanceOf(DEAD_ADDRESS);
  console.log("\n[Step 5] Dead Address FARM Balance Before:", ethers.formatEther(deadBalBefore), "FARM");

  // 6. Test triggerBuyBack()
  console.log("\n[Step 6] Triggering triggerBuyBack() on-chain...");
  console.log("Executing PancakeSwap swapExactETHForTokensSupportingFeeOnTransferTokens -> DEAD...");
  const buyBackTx = await treasury.triggerBuyBack({
    gasLimit: 800000n,
  });
  console.log("Submitted tx:", buyBackTx.hash);
  const receipt = await buyBackTx.wait();
  console.log("✓ BuyBack transaction confirmed in block:", receipt?.blockNumber);

  // 7. Verify Results & Proof of Burn
  const deadBalAfter = await farmToken.balanceOf(DEAD_ADDRESS);
  const vaultBnbAfter = await ethers.provider.getBalance(treasuryAddress);
  const totalBurned = await treasury.totalBurned();
  const totalBnbSpent = await treasury.totalBnbSpent();

  console.log("\n=================================================");
  console.log("LIVE TEST RESULTS ON BSC TESTNET");
  console.log("=================================================");
  console.log("Treasury Vault Address :", treasuryAddress);
  console.log("Vault BNB Remaining    :", ethers.formatEther(vaultBnbAfter), "BNB");
  console.log("Dead FARM Balance After:", ethers.formatEther(deadBalAfter), "FARM");
  console.log("FARM Burned in this Tx :", ethers.formatEther(deadBalAfter - deadBalBefore), "FARM");
  console.log("Total Burned on Vault  :", ethers.formatEther(totalBurned), "FARM");
  console.log("Total BNB Spent        :", ethers.formatEther(totalBnbSpent), "BNB");
  console.log("Tx on BSCScan          : https://testnet.bscscan.com/tx/" + buyBackTx.hash);

  // Write deployment result to deployments directory
  const outFile = path.join(__dirname, "../deployments/treasuryBuyBack-bscTestnet.json");
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: "bscTestnet",
        treasuryBuyBack: treasuryAddress,
        farmToken: farmTokenAddress,
        router: routerAddress,
        pair: await farmToken.pancakePair(),
        buyBackTxHash: buyBackTx.hash,
        farmBurned: ethers.formatEther(deadBalAfter - deadBalBefore),
        testedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("✓ Deployment record saved to:", outFile);
}

main().catch((e) => {
  console.error("FATAL ERROR in testTreasuryBuyBackLive:", e);
  process.exit(1);
});
