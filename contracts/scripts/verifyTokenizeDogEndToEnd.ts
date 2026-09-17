import { ethers, network } from "hardhat";

async function main() {
  console.log("=======================================================================");
  console.log("VERIFICATION: CHÓ CỎ (GOLD) -> TOKENIZE TO NFT (15 $FARM)");
  console.log("=======================================================================");

  // 1. Fork BSC Testnet with the live on-chain state
  console.log("\n[Step 1] Forking BSC Testnet at latest block...");
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

  const [admin, player] = await ethers.getSigners();
  const playerAddress = player.address;

  const farmTokenAddress = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";
  const nftContractAddress = "0x67dd94bAb17F6584d409816fee1EDD5612e7caEa";
  const fusionContractAddress = "0x84BfC3Fc7cc9e223cc8ed690AFB32b060166af29";
  const backendSignerAddress = "0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5";

  // Impersonate deployer
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [backendSignerAddress],
  });
  const deployer = await ethers.getSigner(backendSignerAddress);
  await admin.sendTransaction({
    to: backendSignerAddress,
    value: ethers.parseEther("5.0"),
  });

  // Load contracts via getContractFactory
  const FarmFactory = await ethers.getContractFactory("FarmToken");
  const farm = FarmFactory.attach(farmTokenAddress).connect(deployer) as any;

  const NftFactory = await ethers.getContractFactory("GuardDogNFT");
  const nft = NftFactory.attach(nftContractAddress).connect(deployer) as any;

  const FusionFactory = await ethers.getContractFactory("BanditDogFusion");
  const fusion = FusionFactory.attach(fusionContractAddress).connect(deployer) as any;

  // 2. Verify on-chain parameters
  console.log("\n[Step 2] Verifying On-Chain Parameters on BanditDogFusion...");
  const tokenizeCost = await fusion.tokenizeCost();
  const tokenizeCost3x = await fusion.tokenizeCost3x();
  const onchainFarm = await fusion.farmToken();
  const onchainNft = await fusion.nftContract();
  const onchainSigner = await fusion.backendSigner();
  const nftFusionContract = await nft.fusionContract();

  console.log(`  tokenizeCost (1 Dog)   : ${ethers.formatEther(tokenizeCost)} FARM (Expected: 15.0 FARM)`);
  console.log(`  tokenizeCost3x (3 Dogs): ${ethers.formatEther(tokenizeCost3x)} FARM (Expected: 40.0 FARM)`);
  console.log(`  farmToken Address      : ${onchainFarm}`);
  console.log(`  Matches FarmTokenV2    : ${onchainFarm.toLowerCase() === farmTokenAddress.toLowerCase()}`);
  console.log(`  nftContract Address    : ${onchainNft}`);
  console.log(`  backendSigner Address  : ${onchainSigner}`);
  console.log(`  NFT fusionContract     : ${nftFusionContract}`);
  console.log(`  Matches Fusion v4      : ${nftFusionContract.toLowerCase() === fusionContractAddress.toLowerCase()}`);

  if (
    ethers.formatEther(tokenizeCost) !== "15.0" ||
    ethers.formatEther(tokenizeCost3x) !== "40.0" ||
    onchainFarm.toLowerCase() !== farmTokenAddress.toLowerCase() ||
    nftFusionContract.toLowerCase() !== fusionContractAddress.toLowerCase()
  ) {
    throw new Error("On-chain contract parameter mismatch!");
  }
  console.log("✓ Contract configuration is 100% CORRECT and aligned with FarmTokenV2!");

  // 3. Fund player with 100 $FARM and BNB
  console.log("\n[Step 3] Funding player with 100 $FARM on testnet fork...");
  await farm.connect(deployer).transfer(playerAddress, ethers.parseEther("100.0"));
  const playerFarmBefore = await farm.balanceOf(playerAddress);
  console.log(`✓ Player FARM balance: ${ethers.formatEther(playerFarmBefore)} FARM`);

  // 4. Generate Backend Voucher Signature (Simulating POST /api/web3/tokenize-dog)
  console.log("\n[Step 4] Simulating Backend Signature Generation (POST /api/web3/tokenize-dog)...");
  const count = 1;
  const nonce = 77;

  // Sign using actual backend private key
  const signerWallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY!, ethers.provider);
  console.log(`  Signer Wallet : ${signerWallet.address} (Matches backendSigner: ${signerWallet.address.toLowerCase() === backendSignerAddress.toLowerCase()})`);

  // Hash matching: keccak256(abi.encodePacked(msg.sender, count, nonce))
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256"],
    [playerAddress, count, nonce]
  );
  const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));
  console.log(`  Player Wallet : ${playerAddress}`);
  console.log(`  Tokenize Count: ${count}`);
  console.log(`  Nonce         : ${nonce}`);
  console.log(`  Signature     : ${signature.slice(0, 30)}...`);

  // 5. Approve 15 $FARM to BanditDogFusion
  console.log("\n[Step 5] Player Approving 15 $FARM to BanditDogFusion...");
  await farm.connect(player).approve(fusionContractAddress, tokenizeCost);
  console.log("✓ Approved 15 $FARM successfully");

  // 6. Execute tokenizeDog on-chain
  console.log("\n[Step 6] Player Calling BanditDogFusion.tokenizeDog(count=1, nonce=77, sig)...");
  const playerNftBefore = await nft.balanceOf(playerAddress, 1);
  const farmSupplyBefore = await farm.totalSupply();

  console.log(`  Player NFT Dog Tier 1 before: ${playerNftBefore.toString()}`);
  console.log(`  FARM Total Supply before    : ${ethers.formatEther(farmSupplyBefore)} FARM`);

  const tx = await fusion.connect(player).tokenizeDog(count, nonce, signature);
  const receipt = await tx.wait();
  console.log(`✓ Transaction confirmed! Gas used: ${receipt.gasUsed.toString()} in tx: ${tx.hash}`);

  // 7. Verify Results
  console.log("\n[Step 7] Verifying State Changes...");
  const playerNftAfter = await nft.balanceOf(playerAddress, 1);
  const playerFarmAfter = await farm.balanceOf(playerAddress);
  const farmSupplyAfter = await farm.totalSupply();

  console.log("=======================================================================");
  console.log("END-TO-END VERIFICATION AUDIT RESULTS");
  console.log("=======================================================================");
  console.log(`Player FARM balance before : ${ethers.formatEther(playerFarmBefore)} FARM`);
  console.log(`Player FARM balance after  : ${ethers.formatEther(playerFarmAfter)} FARM (-15.0 FARM)`);
  console.log(`FARM Total Supply before   : ${ethers.formatEther(farmSupplyBefore)} FARM`);
  console.log(`FARM Total Supply after    : ${ethers.formatEther(farmSupplyAfter)} FARM (-15.0 FARM permanently burned!)`);
  console.log(`Player NFT Dog (Tier 1)    : ${playerNftBefore.toString()} -> ${playerNftAfter.toString()} (+1 Dog NFT minted!)`);

  const breedInfo = await nft.breeds(1);
  console.log(`NFT Breed Name (Token ID 1): ${breedInfo.name}`);
  console.log(`NFT Defense Power          : ${breedInfo.defensePower.toString()}%`);

  if (
    playerFarmAfter === playerFarmBefore - tokenizeCost &&
    farmSupplyAfter === farmSupplyBefore - tokenizeCost &&
    playerNftAfter === playerNftBefore + 1n
  ) {
    console.log("\n>>> ✅ 100% VERIFIED: CHÓ CỎ ĐÃ ĐƯỢC ĐÚC THÀNH NFT VỚI GIÁ 15 $FARM HOẠT ĐỘNG HOÀN HẢO! <<<");
  } else {
    throw new Error("Verification failed!");
  }
}

main().catch((e) => {
  console.error("Verification error:", e);
  process.exit(1);
});
