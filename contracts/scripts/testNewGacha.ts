import { ethers } from "hardhat";

const newGachaAddr = "0x5f0c3c5A4745c5EffAd7328AD93972f6474B4118";
const nftAddr = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";
const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing new Gacha with deployer:", deployer.address);

  const farm = await ethers.getContractAt("IERC20", farmAddr);
  const nft = await ethers.getContractAt("GuardDogNFT", nftAddr);
  const gacha = await ethers.getContractAt("BanditDogFusion", newGachaAddr);

  // 1. Approve Gacha contract to spend FARM
  const pullCost = await gacha.pullCost();
  console.log("Pull cost:", ethers.formatEther(pullCost), "FARM");

  const allowance = await farm.allowance(deployer.address, newGachaAddr);
  if (allowance < pullCost) {
    console.log("Approving FARM...");
    const tx = await farm.approve(newGachaAddr, pullCost * 10n);
    await tx.wait();
    console.log("Approved!");
  }

  // 2. Generate secret and commitment
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret, deployer.address]);
  console.log("Secret:", secret);
  console.log("Commitment:", commitment);

  // 3. Commit
  console.log("Calling commit()...");
  const commitTx = await gacha.commit(commitment);
  const commitReceipt = await commitTx.wait();
  console.log("Commit tx confirmed at block:", commitReceipt?.blockNumber);

  // 4. Wait 2 blocks
  const minBlocks = await gacha.MIN_REVEAL_BLOCKS();
  console.log("MIN_REVEAL_BLOCKS:", minBlocks.toString());
  
  let currentBlock = await ethers.provider.getBlockNumber();
  const targetBlock = (commitReceipt?.blockNumber ?? currentBlock) + Number(minBlocks);
  console.log(`Waiting until block ${targetBlock} (current: ${currentBlock})...`);

  while (currentBlock < targetBlock) {
    await new Promise(r => setTimeout(r, 3000));
    currentBlock = await ethers.provider.getBlockNumber();
    console.log(`Current block: ${currentBlock} / ${targetBlock}`);
  }

  // 5. Reveal
  console.log("Calling reveal()...");
  const revealTx = await gacha.reveal(secret);
  const revealReceipt = await revealTx.wait();
  console.log("Reveal tx confirmed! Hash:", revealTx.hash);

  for (const log of revealReceipt?.logs ?? []) {
    try {
      const parsed = gacha.interface.parseLog(log);
      if (parsed) {
        console.log("Event:", parsed.name, parsed.args);
      }
    } catch {
      // not a gacha event
    }
  }

  console.log("SUCCESS! Gacha commit and reveal worked perfectly on new contract!");
}

main().catch(console.error);
