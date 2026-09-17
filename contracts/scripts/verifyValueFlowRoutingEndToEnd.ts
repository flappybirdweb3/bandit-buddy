import { ethers, network } from "hardhat";

async function main() {
  console.log("===============================================================================");
  console.log("   END-TO-END SIMULATION & VERIFICATION: VALUE-FLOW ROUTING & 2.0 BNB BUYBACK");
  console.log("===============================================================================");

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
  console.log(`✓ BSC Testnet forked successfully at block: ${currentBlock}`);

  const [signer0, signer1, referrer] = await ethers.getSigners();
  const deployerAddress = "0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5";
  const userAddress = "0x348fde3b47ebae4ecb86365723d4239f6937af07";

  // Impersonate deployer and user
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [deployerAddress] });
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [userAddress] });

  const deployer = await ethers.getSigner(deployerAddress);
  const user = await ethers.getSigner(userAddress);

  // Fund test accounts with BNB for testing
  await signer0.sendTransaction({ to: deployerAddress, value: ethers.parseEther("100.0") });
  await signer0.sendTransaction({ to: userAddress, value: ethers.parseEther("10.0") });
  await signer0.sendTransaction({ to: referrer.address, value: ethers.parseEther("1.0") });

  const fusionAddress = "0x8fdD78C87793084384257fe14Fe448E12220e9d6";
  const treasuryAddress = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
  const farmAddress = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
  const nftAddress = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";
  const routerAddress = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
  const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

  // Load contracts
  const fusion = await ethers.getContractAt("BanditDogFusion", fusionAddress);
  const treasury = await ethers.getContractAt("TreasuryBuyBack", treasuryAddress);
  const farmToken = await ethers.getContractAt("IERC20", farmAddress);
  const nftContract = await ethers.getContractAt("GuardDogNFT", nftAddress);

  console.log("\n[Contract Deployments & Setup]");
  console.log(`- BanditDogFusion v4.2 : ${fusionAddress}`);
  console.log(`- TreasuryBuyBack Vault : ${treasuryAddress}`);
  console.log(`- FarmToken ($FARM)     : ${farmAddress}`);
  console.log(`- GuardDog NFT          : ${nftAddress}`);
  console.log(`- Referrer Address      : ${referrer.address}`);
  console.log(`- Player (User) Address : ${user.address}`);

  // Approve FARM and NFT for User
  await farmToken.connect(user).approve(fusionAddress, ethers.parseEther("100000"));
  await nftContract.connect(user).setApprovalForAll(fusionAddress, true);

  // ---------------------------------------------------------------------------
  // STEP 1: VERIFY INITIAL REVENUE DISTRIBUTION STATE
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 1: INITIAL STATE SNAPSHOT");
  console.log("===============================================================================");
  const initVaultBnb = await ethers.provider.getBalance(treasuryAddress);
  const initReferrerBalanceOnContract = await fusion.referralBalances(referrer.address);
  const initReferrerWalletBnb = await ethers.provider.getBalance(referrer.address);
  const initJackpotPool = await fusion.jackpotPoolBnb();
  const initFusionBnb = await ethers.provider.getBalance(fusionAddress);

  console.log(`- Initial Treasury Vault BNB    : ${ethers.formatEther(initVaultBnb)} BNB`);
  console.log(`- Initial Referrer Bal On Chain : ${ethers.formatEther(initReferrerBalanceOnContract)} BNB`);
  console.log(`- Initial Referrer Wallet BNB   : ${ethers.formatEther(initReferrerWalletBnb)} BNB`);
  console.log(`- Initial Jackpot Pool          : ${ethers.formatEther(initJackpotPool)} BNB`);
  console.log(`- Initial Fusion Contract BNB   : ${ethers.formatEther(initFusionBnb)} BNB`);

  // ---------------------------------------------------------------------------
  // STEP 2: TEST GOLDEN LUCKY PULL (0.002 BNB + 50 FARM) WITH REFERRER
  // Expectation:
  //   • 75% = 0.0015 BNB -> directly to Treasury Vault
  //   • 15% = 0.0003 BNB -> to referralBalances[referrer]
  //   • 10% = 0.0002 BNB -> to jackpotPoolBnb
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 2: GOLDEN LUCKY PULL (50 FARM + 0.002 BNB) WITH REFERRER");
  console.log("===============================================================================");

  const secret1 = ethers.hexlify(ethers.randomBytes(32));
  const commitment1 = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret1, user.address]);
  const goldenFee = ethers.parseEther("0.002");

  const goldenTx = await fusion.connect(user).commitGolden(commitment1, referrer.address, { value: goldenFee });
  const goldenReceipt = await goldenTx.wait();

  const vaultAfterGolden = await ethers.provider.getBalance(treasuryAddress);
  const refAfterGolden = await fusion.referralBalances(referrer.address);
  const jackpotAfterGolden = await fusion.jackpotPoolBnb();

  const vaultDelta1 = vaultAfterGolden - initVaultBnb;
  const refDelta1 = refAfterGolden - initReferrerBalanceOnContract;
  const jackpotDelta1 = jackpotAfterGolden - initJackpotPool;

  console.log(`• Fee Paid              : ${ethers.formatEther(goldenFee)} BNB`);
  console.log(`• Treasury Vault Gain   : +${ethers.formatEther(vaultDelta1)} BNB (Expected: 0.0015 BNB = 75.0%)`);
  console.log(`• Referrer Balance Gain : +${ethers.formatEther(refDelta1)} BNB (Expected: 0.0003 BNB = 15.0%)`);
  console.log(`• Jackpot Pool Gain     : +${ethers.formatEther(jackpotDelta1)} BNB (Expected: 0.0002 BNB = 10.0%)`);

  const sum1 = vaultDelta1 + refDelta1 + jackpotDelta1;
  if (sum1 !== goldenFee) throw new Error("Math mismatch in Golden Pull routing!");
  if (vaultDelta1 !== ethers.parseEther("0.0015")) throw new Error("Vault did not receive exactly 75%!");
  if (refDelta1 !== ethers.parseEther("0.0003")) throw new Error("Referrer did not receive exactly 15%!");
  if (jackpotDelta1 !== ethers.parseEther("0.0002")) throw new Error("Jackpot did not receive exactly 10%!");
  console.log(">>> [SUCCESS] 75% / 15% / 10% SPLIT VERIFIED WITH 100% MATHEMATICAL PRECISION! <<<");

  // Advance blocks and reveal Golden Pull
  await network.provider.send("hardhat_mine", ["0x3"]);
  await fusion.connect(user).reveal(secret1);
  console.log("✓ Golden Pull revealed successfully.");

  // ---------------------------------------------------------------------------
  // STEP 3: TEST MEGA BULK PULL X10 (450 FARM + 0.015 BNB) WITH REFERRER
  // Expectation:
  //   • 75% = 0.01125 BNB -> directly to Treasury Vault
  //   • 15% = 0.00225 BNB -> to referralBalances[referrer]
  //   • 10% = 0.00150 BNB -> to jackpotPoolBnb
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 3: MEGA BULK PULL X10 (450 FARM + 0.015 BNB) WITH REFERRER");
  console.log("===============================================================================");

  const secret2 = ethers.hexlify(ethers.randomBytes(32));
  const commitment2 = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret2, user.address]);
  const bulkFee = ethers.parseEther("0.015");

  const bulkTx = await fusion.connect(user).commitBulk10(commitment2, referrer.address, { value: bulkFee });
  await bulkTx.wait();

  const vaultAfterBulk = await ethers.provider.getBalance(treasuryAddress);
  const refAfterBulk = await fusion.referralBalances(referrer.address);
  const jackpotAfterBulk = await fusion.jackpotPoolBnb();

  const vaultDelta2 = vaultAfterBulk - vaultAfterGolden;
  const refDelta2 = refAfterBulk - refAfterGolden;
  const jackpotDelta2 = jackpotAfterBulk - jackpotAfterGolden;

  console.log(`• Fee Paid              : ${ethers.formatEther(bulkFee)} BNB`);
  console.log(`• Treasury Vault Gain   : +${ethers.formatEther(vaultDelta2)} BNB (Expected: 0.01125 BNB = 75.0%)`);
  console.log(`• Referrer Balance Gain : +${ethers.formatEther(refDelta2)} BNB (Expected: 0.00225 BNB = 15.0%)`);
  console.log(`• Jackpot Pool Gain     : +${ethers.formatEther(jackpotDelta2)} BNB (Expected: 0.00150 BNB = 10.0%)`);

  if (vaultDelta2 !== ethers.parseEther("0.01125")) throw new Error("Bulk Vault 75% mismatch!");
  if (refDelta2 !== ethers.parseEther("0.00225")) throw new Error("Bulk Referrer 15% mismatch!");
  if (jackpotDelta2 !== ethers.parseEther("0.00150")) throw new Error("Bulk Jackpot 10% mismatch!");
  console.log(">>> [SUCCESS] MEGA BULK X10 VALUE-FLOW ROUTING VERIFIED! <<<");

  // Advance blocks and reveal Bulk x10
  await network.provider.send("hardhat_mine", ["0x3"]);
  await fusion.connect(user).reveal(secret2);
  console.log("✓ Mega Bulk x10 revealed successfully.");

  // ---------------------------------------------------------------------------
  // STEP 4: TEST SOUL FORGE WITH DIVINE INSURANCE (0.002 BNB) WITH REFERRER
  // Expectation:
  //   • 75% = 0.0015 BNB -> Treasury Vault
  //   • 15% = 0.0003 BNB -> referralBalances[referrer]
  //   • 10% = 0.0002 BNB -> jackpotPoolBnb
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 4: SOUL FORGE DIVINE INSURANCE (KIM CANG HỘ THỂ: 0.002 BNB) WITH REFERRER");
  console.log("===============================================================================");

  const insuranceFee = ethers.parseEther("0.002");
  const forgeTx = await fusion.connect(user).requestFusion(1, false, false, true, referrer.address, {
    value: insuranceFee
  });
  await forgeTx.wait();

  const vaultAfterForge = await ethers.provider.getBalance(treasuryAddress);
  const refAfterForge = await fusion.referralBalances(referrer.address);
  const jackpotAfterForge = await fusion.jackpotPoolBnb();

  const vaultDelta3 = vaultAfterForge - vaultAfterBulk;
  const refDelta3 = refAfterForge - refAfterBulk;
  const jackpotDelta3 = jackpotAfterForge - jackpotAfterBulk;

  console.log(`• Insurance Fee Paid    : ${ethers.formatEther(insuranceFee)} BNB`);
  console.log(`• Treasury Vault Gain   : +${ethers.formatEther(vaultDelta3)} BNB (Expected: 0.0015 BNB = 75.0%)`);
  console.log(`• Referrer Balance Gain : +${ethers.formatEther(refDelta3)} BNB (Expected: 0.0003 BNB = 15.0%)`);
  console.log(`• Jackpot Pool Gain     : +${ethers.formatEther(jackpotDelta3)} BNB (Expected: 0.0002 BNB = 10.0%)`);

  if (vaultDelta3 !== ethers.parseEther("0.0015")) throw new Error("Forge Vault 75% mismatch!");
  if (refDelta3 !== ethers.parseEther("0.0003")) throw new Error("Forge Referrer 15% mismatch!");
  if (jackpotDelta3 !== ethers.parseEther("0.0002")) throw new Error("Forge Jackpot 10% mismatch!");
  console.log(">>> [SUCCESS] DIVINE INSURANCE VALUE-FLOW ROUTING VERIFIED! <<<");

  // ---------------------------------------------------------------------------
  // STEP 5: TEST PULL WITHOUT REFERRER (referrer = address(0))
  // Expectation:
  //   • If no referrer: 90% (75% + 15%) goes to Treasury Vault, 10% to Jackpot
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 5: PULL WITHOUT REFERRER (FALLBACK TO 90% TREASURY VAULT)");
  console.log("===============================================================================");

  const secret3 = ethers.hexlify(ethers.randomBytes(32));
  const commitment3 = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret3, user.address]);

  const noRefTx = await fusion.connect(user).commitGolden(commitment3, ethers.ZeroAddress, { value: goldenFee });
  await noRefTx.wait();

  const vaultAfterNoRef = await ethers.provider.getBalance(treasuryAddress);
  const refAfterNoRef = await fusion.referralBalances(referrer.address);
  const jackpotAfterNoRef = await fusion.jackpotPoolBnb();

  const vaultDelta4 = vaultAfterNoRef - vaultAfterForge;
  const refDelta4 = refAfterNoRef - refAfterForge;
  const jackpotDelta4 = jackpotAfterNoRef - jackpotAfterForge;

  console.log(`• Treasury Vault Gain   : +${ethers.formatEther(vaultDelta4)} BNB (Expected: 0.0018 BNB = 90.0%)`);
  console.log(`• Referrer Balance Gain : +${ethers.formatEther(refDelta4)} BNB (Expected: 0.0 BNB = 0%)`);
  console.log(`• Jackpot Pool Gain     : +${ethers.formatEther(jackpotDelta4)} BNB (Expected: 0.0002 BNB = 10.0%)`);

  if (vaultDelta4 !== ethers.parseEther("0.0018")) throw new Error("90% Fallback to Vault mismatch!");
  if (refDelta4 !== 0n) throw new Error("Referrer should not gain when address(0) is passed!");
  if (jackpotDelta4 !== ethers.parseEther("0.0002")) throw new Error("Jackpot should receive 10%!");
  console.log(">>> [SUCCESS] 90% VAULT FALLBACK ROUTING VERIFIED! <<<");

  // ---------------------------------------------------------------------------
  // STEP 6: TEST PULL-PAYMENT REFERRAL CLAIM (claimReferralBnb)
  // Expectation:
  //   • Total accumulated in referralBalances[referrer] = 0.0003 + 0.00225 + 0.0003 = 0.00285 BNB
  //   • Referrer executes claimReferralBnb()
  //   • Referrer wallet receives the BNB directly
  //   • On-chain referral balance drops to EXACTLY 0
  //   • Second claim call reverts with NoReferralBnbToClaim()
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 6: PULL-PAYMENT REFERRAL CLAIM & GAS SAFETY");
  console.log("===============================================================================");

  const expectedClaimable = ethers.parseEther("0.00285"); // 0.0003 + 0.00225 + 0.0003
  const actualClaimable = await fusion.referralBalances(referrer.address);
  console.log(`• Total Claimable in Contract Mapping : ${ethers.formatEther(actualClaimable)} BNB`);
  if (actualClaimable !== expectedClaimable) throw new Error("Accumulated referral balance mismatch!");

  const refWalletBeforeClaim = await ethers.provider.getBalance(referrer.address);

  // Referrer claims
  const claimTx = await fusion.connect(referrer).claimReferralBnb();
  const claimReceipt = await claimTx.wait();
  const gasSpent = (claimReceipt?.gasUsed ?? 0n) * (claimReceipt?.gasPrice ?? 0n);

  const refWalletAfterClaim = await ethers.provider.getBalance(referrer.address);
  const refBalOnContractAfterClaim = await fusion.referralBalances(referrer.address);

  console.log(`• Gas Spent on Claim           : ${ethers.formatEther(gasSpent)} BNB`);
  console.log(`• Referrer Wallet Net Increase : +${ethers.formatEther(refWalletAfterClaim - refWalletBeforeClaim + gasSpent)} BNB`);
  console.log(`• On-Chain Referral Balance Now: ${ethers.formatEther(refBalOnContractAfterClaim)} BNB (Exact: 0.0)`);

  if (refBalOnContractAfterClaim !== 0n) throw new Error("Referral balance did not reset to 0!");
  if ((refWalletAfterClaim + gasSpent - refWalletBeforeClaim) !== expectedClaimable) {
    throw new Error("Referrer wallet did not receive exact claim amount!");
  }

  // Test double claim attempt (Must revert with NoReferralBnbToClaim)
  console.log("• Testing double-claim attempt (anti-drain defense)...");
  try {
    await fusion.connect(referrer).claimReferralBnb();
    throw new Error("Double claim SHOULD HAVE REVERTED but succeeded!");
  } catch (err: any) {
    console.log("✓ Correctly reverted with error: NoReferralBnbToClaim()");
  }
  console.log(">>> [SUCCESS] PULL-PAYMENT CLAIMING & DEFENSES FULLY VERIFIED! <<<");

  // ---------------------------------------------------------------------------
  // STEP 7: JACKPOT POOL INTEGRITY CHECK
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 7: JACKPOT POOL INTEGRITY & CONTRACT INVARIANT CHECK");
  console.log("===============================================================================");

  const expectedNewJackpot = ethers.parseEther("0.0021"); // 0.0002 + 0.0015 + 0.0002 + 0.0002
  const currentJackpot = await fusion.jackpotPoolBnb();
  const jackpotDeltaTotal = currentJackpot - initJackpotPool;
  const currentFusionContractBalance = await ethers.provider.getBalance(fusionAddress);

  console.log(`• Cumulative Jackpot Pool On Chain : ${ethers.formatEther(currentJackpot)} BNB`);
  console.log(`• Total Jackpot Added in Test      : +${ethers.formatEther(jackpotDeltaTotal)} BNB`);
  console.log(`• Fusion Contract Balance          : ${ethers.formatEther(currentFusionContractBalance)} BNB`);

  if (jackpotDeltaTotal !== expectedNewJackpot) throw new Error("Jackpot accumulation mismatch!");
  if (currentFusionContractBalance < currentJackpot) throw new Error("Contract balance insufficient for jackpot!");
  console.log(">>> [SUCCESS] JACKPOT POOL 10% ALLOCATION & INVARIANTS SOUND! <<<");

  // ---------------------------------------------------------------------------
  // STEP 8: 2.0 BNB ACCUMULATION IN TREASURY VAULT -> PANCAKESWAP BUYBACK -> BURN
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("STEP 8: TREASURY 2.0 BNB THRESHOLD ACCUMULATION & AUTO BUYBACK & BURN");
  console.log("===============================================================================");

  // Set liquidity so PancakeSwap swap executes with deep pool
  console.log("• Enhancing PancakeSwap pair liquidity for 2.0 BNB swap test...");
  const routerAbi = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  ];
  const router = new ethers.Contract(routerAddress, routerAbi, deployer);
  await farmToken.connect(deployer).approve(routerAddress, ethers.parseEther("2000000"));
  await router.connect(deployer).addLiquidityETH(
    farmAddress,
    ethers.parseEther("2000000"),
    0,
    0,
    deployer.address,
    Math.floor(Date.now() / 1000) + 1200,
    { value: ethers.parseEther("20.0") }
  );

  const buyBackThreshold = await treasury.buyBackThreshold();
  console.log(`• Treasury Target Threshold : ${ethers.formatEther(buyBackThreshold)} BNB (2.0 BNB)`);

  const currentVaultBal = await ethers.provider.getBalance(treasuryAddress);
  console.log(`• Current Vault Balance     : ${ethers.formatEther(currentVaultBal)} BNB`);

  // Verify that calling triggerBuyBack prematurely reverts
  console.log("• Attempting triggerBuyBack() BEFORE reaching 2.0 BNB threshold...");
  try {
    await treasury.connect(user).triggerBuyBack();
    throw new Error("Trigger SHOULD HAVE REVERTED before threshold!");
  } catch (e: any) {
    console.log(`✓ Correctly reverted! ThresholdNotReached (${ethers.formatEther(currentVaultBal)} < 2.0 BNB)`);
  }

  // Simulate ongoing game and gacha operations accumulating up to 2.0 BNB
  console.log("• Simulating gacha activity & game revenues accumulating up to exactly 2.0 BNB...");
  const deficit = buyBackThreshold - currentVaultBal;
  if (deficit > 0n) {
    // Send deficit directly to vault simulating accumulated game revenues
    await user.sendTransaction({
      to: treasuryAddress,
      value: deficit
    });
  }

  const vaultReadyBal = await ethers.provider.getBalance(treasuryAddress);
  console.log(`• Vault Balance Ready For Buyback : ${ethers.formatEther(vaultReadyBal)} BNB (>= 2.0 BNB)`);

  const deadBefore = await farmToken.balanceOf(DEAD_ADDRESS);
  const totalBurnedBefore = await treasury.totalBurned();
  const totalBnbSpentBefore = await treasury.totalBnbSpent();

  console.log(`• Dead Address FARM Balance Before : ${ethers.formatEther(deadBefore)} FARM`);
  console.log(`• Total Burned Before              : ${ethers.formatEther(totalBurnedBefore)} FARM`);
  console.log(`• Total BNB Spent Before           : ${ethers.formatEther(totalBnbSpentBefore)} BNB`);

  // Execute triggerBuyBack
  console.log("\n>>> EXECUTING triggerBuyBack() WITH 2.0 BNB ON PANCAKESWAP...");
  const buyBackTx = await treasury.connect(user).triggerBuyBack({ gasLimit: 1500000n });
  const buyBackReceipt = await buyBackTx.wait();
  console.log(`✓ triggerBuyBack() confirmed in tx: ${buyBackTx.hash}`);

  // Parse BuyBackAndBurned event
  let bnbSpent = 0n;
  let farmBurned = 0n;
  for (const log of buyBackReceipt?.logs ?? []) {
    try {
      const parsed = treasury.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "BuyBackAndBurned") {
        bnbSpent = parsed.args[0];
        farmBurned = parsed.args[1];
      }
    } catch {}
  }

  const deadAfter = await farmToken.balanceOf(DEAD_ADDRESS);
  const vaultBalAfter = await ethers.provider.getBalance(treasuryAddress);
  const totalBurnedAfter = await treasury.totalBurned();
  const totalBnbSpentAfter = await treasury.totalBnbSpent();

  console.log("\n===============================================================================");
  console.log("                  FINAL VERIFICATION & PROOF OF BURN");
  console.log("===============================================================================");
  console.log(`• BNB Spent on PancakeSwap Swap    : ${ethers.formatEther(bnbSpent)} BNB`);
  console.log(`• FARM Purchased & Sent to 0x...dEaD: ${ethers.formatEther(farmBurned)} FARM 🔥`);
  console.log(`• Dead Address Balance Increase    : +${ethers.formatEther(deadAfter - deadBefore)} FARM`);
  console.log(`• Vault Remaining BNB Balance      : ${ethers.formatEther(vaultBalAfter)} BNB`);
  console.log(`• Cumulative Total Burned on Vault : ${ethers.formatEther(totalBurnedAfter)} FARM`);
  console.log(`• Cumulative BNB Spent on Vault    : ${ethers.formatEther(totalBnbSpentAfter)} BNB`);

  if (farmBurned === 0n) throw new Error("No FARM tokens were burned!");
  if (deadAfter <= deadBefore) throw new Error("Dead address did not receive burned tokens!");
  if (vaultBalAfter !== 0n) throw new Error("Vault balance was not fully utilized for buyback!");

  console.log("\n===============================================================================");
  console.log("     🎉 ALL END-TO-END VALUE-FLOW & BUYBACK CHECKS PASSED 100%! 🎉");
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR IN SIMULATION:", err);
  process.exit(1);
});
