import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying LiquidityLocker on ${network.name} with ${deployer.address}`);

  const LiquidityLocker = await ethers.getContractFactory("LiquidityLocker");
  const locker = await LiquidityLocker.deploy(deployer.address);
  await locker.waitForDeployment();
  const lockerAddress = await locker.getAddress();
  console.log(`LiquidityLocker deployed: ${lockerAddress}`);

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `liquidityLocker-${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    network: network.name,
    liquidityLocker: lockerAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }, null, 2));
  console.log(`Saved: ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
