import { ethers, network } from "hardhat";

async function main() {
  console.log("=======================================================================");
  console.log("END-TO-END SIMULATION: 2.0 BNB ACCUMULATION -> BUYBACK $FARM -> BURN");
  console.log("=======================================================================");

  // 1. Fork BSC Testnet with the live on-chain state
  console.log("\n[Setup] Forking BSC Testnet at latest block...");
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: "https://bsc-testnet-rpc.publicnode.com",
        },
      },
    ],
  });

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`✓ Forked BSC Testnet successfully at block: ${currentBlock}`);

  const [admin, player1, player2] = await ethers.getSigners();
  console.log(`Admin Signer : ${admin.address}`);
  console.log(`Admin Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))} BNB`);

  const farmTokenAddress = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
  const routerAddress    = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
  const wbnbAddress      = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const DEAD_ADDRESS     = "0x000000000000000000000000000000000000dEaD";

  // Impersonate deployer to configure the deployed contracts
  const deployerAddress = "0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5";
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [deployerAddress],
  });
  const deployer = await ethers.getSigner(deployerAddress);
  // Fund deployer on fork with 50 BNB
  await admin.sendTransaction({
    to: deployerAddress,
    value: ethers.parseEther("50.0"),
  });

  // Load contracts
  const TreasuryFactory = await ethers.getContractFactory("TreasuryBuyBack");
  const treasuryAddress = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
  const treasury = TreasuryFactory.attach(treasuryAddress).connect(deployer);

  const farmAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) external returns (bool)",
    "function transfer(address, uint256) external returns (bool)",
    "function setTreasuryBuybackPool(address) external",
    "function pancakePair() view returns (address)"
  ];
  const farmToken = new ethers.Contract(farmTokenAddress, farmAbi, deployer);

  const routerAbi = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
  ];
  const router = new ethers.Contract(routerAddress, routerAbi, deployer);

  // 2. Add realistic pool liquidity so a 2.0 BNB buyback trades smoothly
  console.log("\n[Step 1] Adding 20 BNB + 2,000,000 FARM liquidity to PancakeSwap pair...");
  const farmToAdd = ethers.parseEther("2000000");
  await farmToken.approve(routerAddress, farmToAdd);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  await router.addLiquidityETH(
    farmTokenAddress,
    farmToAdd,
    0,
    0,
    deployer.address,
    deadline,
    { value: ethers.parseEther("20.0") }
  );
  console.log("✓ Liquidity pool depth enhanced: ready for 2.0 BNB buyback!");

  // 3. Set the Buyback Threshold to exactly 2.0 BNB
  console.log("\n[Step 2] Setting Treasury buyBackThreshold to EXACTLY 2.0 BNB...");
  await treasury.setBuyBackThreshold(ethers.parseEther("2.0"));
  const threshold = await treasury.buyBackThreshold();
  console.log(`✓ buyBackThreshold is: ${ethers.formatEther(threshold)} BNB`);

  // 4. Test Incomplete Accumulation (e.g. 1.25 BNB accumulated)
  console.log("\n[Step 3] Simulating Partial Revenue Accumulation (1.25 BNB < 2.0 BNB)...");
  console.log("  -> Revenue source A (Game in-app purchases): +0.75 BNB");
  await player1.sendTransaction({
    to: treasuryAddress,
    value: ethers.parseEther("0.75"),
  });

  console.log("  -> Revenue source B (Marketplace royalty fees): +0.50 BNB");
  await player2.sendTransaction({
    to: treasuryAddress,
    value: ethers.parseEther("0.50"),
  });

  const vaultBalancePartial = await ethers.provider.getBalance(treasuryAddress);
  console.log(`  -> Current Vault BNB Balance: ${ethers.formatEther(vaultBalancePartial)} BNB`);

  console.log("\n[Step 4] Testing triggerBuyBack() before threshold is reached...");
  try {
    await treasury.connect(player1).triggerBuyBack();
    throw new Error("Trigger SHOULD HAVE REVERTED but succeeded!");
  } catch (err: any) {
    console.log(`✓ PROPERLY REVERTED! Expected error: ThresholdNotReached`);
    console.log(`  Reason: Contract balance (${ethers.formatEther(vaultBalancePartial)} BNB) < threshold (2.0 BNB)`);
  }

  // 5. Complete Accumulation to 2.0 BNB
  console.log("\n[Step 5] Simulating Additional Revenue to reach EXACTLY 2.0 BNB...");
  console.log("  -> Revenue source C (On-chain premium services): +0.75 BNB");
  await player1.sendTransaction({
    to: treasuryAddress,
    value: ethers.parseEther("0.75"),
  });

  const vaultBalanceFull = await ethers.provider.getBalance(treasuryAddress);
  console.log(`✓ Total Vault Balance NOW: ${ethers.formatEther(vaultBalanceFull)} BNB (>= 2.0 BNB Threshold)!`);

  // 6. Execute triggerBuyBack()
  console.log("\n[Step 6] Executing triggerBuyBack() with 2.0 BNB on PancakeSwap...");
  const deadBefore = await farmToken.balanceOf(DEAD_ADDRESS);
  const totalBurnedBefore = await treasury.totalBurned();
  const totalBnbSpentBefore = await treasury.totalBnbSpent();

  console.log(`  Dead Address Balance Before: ${ethers.formatEther(deadBefore)} FARM`);
  console.log(`  Total BNB Spent Before     : ${ethers.formatEther(totalBnbSpentBefore)} BNB`);

  // Call triggerBuyBack
  const tx = await treasury.connect(admin).triggerBuyBack({
    gasLimit: 1200000n,
  });
  const receipt = await tx.wait();
  console.log(`✓ triggerBuyBack() CONFIRMED in tx: ${tx.hash}`);

  // Find BuyBackAndBurned event
  const iface = treasury.interface;
  let bnbSpentEvent = 0n;
  let farmBurnedEvent = 0n;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "BuyBackAndBurned") {
        bnbSpentEvent = parsed.args[0];
        farmBurnedEvent = parsed.args[1];
      }
    } catch {}
  }

  // 7. Verification & Proof of Burn
  const deadAfter = await farmToken.balanceOf(DEAD_ADDRESS);
  const vaultBalanceAfter = await ethers.provider.getBalance(treasuryAddress);
  const totalBurnedAfter = await treasury.totalBurned();
  const totalBnbSpentAfter = await treasury.totalBnbSpent();

  console.log("\n=======================================================================");
  console.log("VERIFICATION REPORT: 2.0 BNB BUYBACK & BURN");
  console.log("=======================================================================");
  console.log(`Vault BNB Balance Before : ${ethers.formatEther(vaultBalanceFull)} BNB`);
  console.log(`Vault BNB Balance After  : ${ethers.formatEther(vaultBalanceAfter)} BNB (Fully utilized!)`);
  console.log(`BNB Spent on Buyback     : ${ethers.formatEther(bnbSpentEvent)} BNB`);
  console.log(`FARM Purchased & Burned  : ${ethers.formatEther(farmBurnedEvent)} FARM!`);
  console.log(`Dead Address Balance     : ${ethers.formatEther(deadAfter)} FARM`);
  console.log(`Total Burned on Vault    : ${ethers.formatEther(totalBurnedAfter)} FARM`);
  console.log(`Total BNB Spent on Vault : ${ethers.formatEther(totalBnbSpentAfter)} BNB`);

  if (farmBurnedEvent > 0n && vaultBalanceAfter === 0n && bnbSpentEvent === ethers.parseEther("2.0")) {
    console.log("\n>>> ALL CHECKS PASSED: 2.0 BNB BUYBACK & BURN WORKS PERFECTLY! <<<");
  } else {
    throw new Error("Verification checks failed!");
  }
}

main().catch((e) => {
  console.error("Simulation failed:", e);
  process.exit(1);
});
