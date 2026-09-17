import { ethers } from "hardhat";

async function main() {
  const user = "0x348fde3b47ebae4ecb86365723d4239f6937af07";
  const gachaAddr = "0x5f0c3c5A4745c5EffAd7328AD93972f6474B4118";
  const vaultAddr = "0xe59FfB05EdF59464e8803E81A4d790d828915006";
  const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
  const nftAddr = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";

  const farm = await ethers.getContractAt("IERC20", farmAddr);
  const nft = await ethers.getContractAt("GuardDogNFT", nftAddr);
  const gacha = await ethers.getContractAt("BanditDogFusion", gachaAddr);

  console.log("=== USER BALANCES ===");
  console.log("User BNB:", ethers.formatEther(await ethers.provider.getBalance(user)));
  console.log("User FARM:", ethers.formatEther(await farm.balanceOf(user)));

  console.log("=== VAULT BALANCES ===");
  console.log("Vault BNB:", ethers.formatEther(await ethers.provider.getBalance(vaultAddr)));
  console.log("Vault FARM:", ethers.formatEther(await farm.balanceOf(vaultAddr)));

  console.log("=== GACHA STATUS ===");
  const pull = await gacha.pendingPulls(user);
  console.log("User pendingPull:", {
    commitment: pull.commitment,
    commitBlock: pull.commitBlock.toString(),
    revealed: pull.revealed
  });
  console.log("User pityCounter:", (await gacha.pityCounter(user)).toString());

  console.log("=== USER DOG NFTs ===");
  for (let i = 1; i <= 6; i++) {
    console.log(`Breed ${i}:`, (await nft.balanceOf(user, i)).toString());
  }
  console.log("Soul Shards (9999):", (await nft.balanceOf(user, 9999)).toString());

  console.log("=== RECENT GACHA EVENTS FOR USER ===");
  const commitBlock = Number(pull.commitBlock);
  const fromBlock = commitBlock - 2;
  const toBlock = commitBlock + 10;
  console.log(`Querying events from block ${fromBlock} to ${toBlock}...`);
  
  const revealedEvents = await gacha.queryFilter(gacha.filters.Revealed(user), fromBlock, toBlock);
  console.log("Revealed events:", revealedEvents.length);
  for (const ev of revealedEvents) {
    console.log("  Revealed Tx:", ev.transactionHash, "TokenId:", ev.args[1].toString(), "Pity:", ev.args[2].toString());
  }

  const fusionEvents = await gacha.queryFilter(gacha.filters.FusionRequested(null, user), fromBlock, toBlock);
  console.log("FusionRequested events:", fusionEvents.length);
  for (const ev of fusionEvents) {
    console.log("  FusionRequested Tx:", ev.transactionHash, "BaseTier:", ev.args[2].toString(), "Cost:", ethers.formatEther(ev.args[5]));
  }

  const fusionResolvedEvents = await gacha.queryFilter(gacha.filters.FusionResolved(null, user), fromBlock, currentBlock);
  console.log("FusionResolved events:", fusionResolvedEvents.length);
  for (const ev of fusionResolvedEvents) {
    console.log("  FusionResolved Tx:", ev.transactionHash, "Success:", ev.args[2], "UpgradedTier:", ev.args[3].toString());
  }
}

main().catch(console.error);
