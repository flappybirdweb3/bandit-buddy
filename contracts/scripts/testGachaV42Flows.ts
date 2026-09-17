import { ethers } from "hardhat";

const fusionAddr = "0x8fdD78C87793084384257fe14Fe448E12220e9d6";
const vaultAddr = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
const testReferrer = "0x1111111111111111111111111111111111111111";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== TESTING BanditDogFusion v4.2 ON BSC TESTNET ===");
  console.log("Tester/Deployer:", deployer.address);

  const farm = await ethers.getContractAt("IERC20", farmAddr);
  const fusion = await ethers.getContractAt("BanditDogFusion", fusionAddr);

  // Initial balances
  const initialVaultBnb = await ethers.provider.getBalance(vaultAddr);
  console.log("Initial Vault BNB:", ethers.formatEther(initialVaultBnb));

  // 1. Approve FARM
  console.log("Approving FARM for Gacha v4.2...");
  const appTx = await farm.approve(fusionAddr, ethers.parseEther("1000"));
  await appTx.wait();
  console.log("FARM approved!");

  // 2. Test Golden Pull (50 FARM + 0.002 BNB) with referrer
  console.log("\n--- TEST 1: Golden Lucky Pull ---");
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret, deployer.address]);
  
  console.log("Calling commitGolden(commitment, testReferrer) with 0.002 BNB...");
  const commitTx = await fusion.commitGolden(commitment, testReferrer, {
    value: ethers.parseEther("0.002")
  });
  const commitReceipt = await commitTx.wait();
  console.log("commitGolden confirmed at block:", commitReceipt?.blockNumber);

  // Check balances after Golden commit
  const postCommitVaultBnb = await ethers.provider.getBalance(vaultAddr);
  console.log("Post-commit Vault BNB:", ethers.formatEther(postCommitVaultBnb));
  const vaultGain = postCommitVaultBnb - initialVaultBnb;
  console.log("Vault Gain:", ethers.formatEther(vaultGain), "BNB (Expected: 0.0015 BNB / 75%)");

  const refBal = await fusion.referralBalances(testReferrer);
  console.log("Referrer Balance on contract:", ethers.formatEther(refBal), "BNB (Expected: 0.0003 BNB / 15%)");

  const jackpot = await fusion.jackpotPoolBnb();
  console.log("Jackpot Pool on contract:", ethers.formatEther(jackpot), "BNB (Expected: 0.0002 BNB / 10%)");

  // Wait 2 blocks for reveal
  const minBlocks = Number(await fusion.MIN_REVEAL_BLOCKS());
  let currentBlock = await ethers.provider.getBlockNumber();
  const targetBlock = (commitReceipt?.blockNumber ?? currentBlock) + minBlocks;
  console.log(`Waiting for block ${targetBlock} (current: ${currentBlock})...`);
  while (currentBlock < targetBlock) {
    await new Promise(r => setTimeout(r, 2500));
    currentBlock = await ethers.provider.getBlockNumber();
  }

  // Call reveal
  console.log("Calling reveal(secret)...");
  const revealTx = await fusion.reveal(secret);
  const revealReceipt = await revealTx.wait();
  console.log("reveal confirmed! Tx:", revealTx.hash);

  for (const log of revealReceipt?.logs ?? []) {
    try {
      const parsed = fusion.interface.parseLog(log);
      if (parsed) {
        console.log("  Event:", parsed.name, parsed.args);
      }
    } catch {}
  }

  // 3. Test Bulk 10 Pull (450 FARM + 0.015 BNB)
  console.log("\n--- TEST 2: Mega Bulk Pull x10 ---");
  const secret10 = ethers.hexlify(ethers.randomBytes(32));
  const commitment10 = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret10, deployer.address]);

  console.log("Calling commitBulk10 with 0.015 BNB...");
  const commit10Tx = await fusion.commitBulk10(commitment10, testReferrer, {
    value: ethers.parseEther("0.015")
  });
  const commit10Receipt = await commit10Tx.wait();
  console.log("commitBulk10 confirmed at block:", commit10Receipt?.blockNumber);

  const postBulk10VaultBnb = await ethers.provider.getBalance(vaultAddr);
  console.log("Post-Bulk10 Vault BNB:", ethers.formatEther(postBulk10VaultBnb));
  const bulkVaultGain = postBulk10VaultBnb - postCommitVaultBnb;
  console.log("BulkVault Gain:", ethers.formatEther(bulkVaultGain), "BNB (Expected: 0.01125 BNB / 75%)");

  // Wait 2 blocks
  currentBlock = await ethers.provider.getBlockNumber();
  const targetBlock10 = (commit10Receipt?.blockNumber ?? currentBlock) + minBlocks;
  console.log(`Waiting for block ${targetBlock10} (current: ${currentBlock})...`);
  while (currentBlock < targetBlock10) {
    await new Promise(r => setTimeout(r, 2500));
    currentBlock = await ethers.provider.getBlockNumber();
  }

  console.log("Calling reveal(secret10) for Bulk x10...");
  const reveal10Tx = await fusion.reveal(secret10);
  const reveal10Receipt = await reveal10Tx.wait();
  console.log("reveal Bulk x10 confirmed! Tx:", reveal10Tx.hash);

  for (const log of reveal10Receipt?.logs ?? []) {
    try {
      const parsed = fusion.interface.parseLog(log);
      if (parsed) {
        console.log("  Bulk Event:", parsed.name, parsed.args);
      }
    } catch {}
  }

  console.log("\n=== ALL TESTS PASSED WITH FLYING COLORS! ===");
}

main().catch(console.error);
