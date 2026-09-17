import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying FarmTokenV2 on ${network.name} with ${deployer.address}`);

  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;

  const FarmToken = await ethers.getContractFactory("FarmToken");
  const farmToken = await FarmToken.deploy(deployer.address);
  await farmToken.waitForDeployment();
  const farmTokenAddress = await farmToken.getAddress();
  console.log(`FarmTokenV2 deployed: ${farmTokenAddress}`);

  const tx = await farmToken.setTreasuryBuybackPool(treasury);
  await tx.wait();
  console.log(`treasuryBuybackPool set: ${treasury}`);

  const excludeList: string[] = [treasury];
  const envExcludes = [
    process.env.BANDIT_MARKET_ADDRESS,
    process.env.BANDIT_DOG_FUSION_ADDRESS,
    process.env.FARM_TOKEN_CLAIM_ADDRESS,
  ].filter((a): a is string => !!a && ethers.isAddress(a));

  for (const addr of [...new Set([...excludeList, ...envExcludes])]) {
    const t = await farmToken.excludeFromFee(addr, true);
    await t.wait();
    console.log(`Excluded from fee: ${addr}`);
  }

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `farmTokenV2-${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    network: network.name,
    farmTokenV2: farmTokenAddress,
    treasuryBuybackPool: treasury,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }, null, 2));
  console.log(`Saved: ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
