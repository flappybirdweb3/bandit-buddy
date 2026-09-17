import { ethers } from "hardhat";

async function main() {
  const fusion = await ethers.getContractAt('BanditDogFusion', '0x8fdD78C87793084384257fe14Fe448E12220e9d6');
  console.log('nextRequestId:', (await fusion.nextRequestId()).toString());
  for (let i = 1; i <= 5; i++) {
    try {
      const req = await fusion.getFusionRequest(i);
      console.log(`req ${i}:`, {
        player: req.player,
        baseTierId: req.baseTierId.toString(),
        useLuckyBone: req.useLuckyBone,
        useCollar: req.useCollar,
        useDivineInsurance: req.useDivineInsurance,
        resolved: req.resolved,
        requestBlock: req.requestBlock.toString(),
        totalCost: ethers.formatEther(req.totalCost)
      });
    } catch(e: any) {
      console.log(`req ${i} error:`, e.message);
    }
  }
}

main().catch(console.error);
