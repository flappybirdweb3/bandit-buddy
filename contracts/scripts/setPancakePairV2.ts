import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../barnbuddy/.env') });

async function main() {
  const [deployer] = await ethers.getSigners();
  const farmTokenAddress = process.env.FARM_TOKEN_ADDRESS!;
  const pairAddress = process.env.PANCAKE_PAIR_ADDRESS!;

  console.log(`FarmToken V2 : ${farmTokenAddress}`);
  console.log(`Pair address : ${pairAddress}`);

  const abi = ['function setPancakePair(address pair) external', 'function pancakePair() external view returns (address)'];
  const token = new ethers.Contract(farmTokenAddress, abi, deployer);

  const current = await token.pancakePair();
  if (current.toLowerCase() === pairAddress.toLowerCase()) {
    console.log('Already set — skipping');
    return;
  }

  const tx = await token.setPancakePair(pairAddress);
  await tx.wait();
  console.log(`setPancakePair done  tx: ${tx.hash}`);
  console.log(`pancakePair now: ${await token.pancakePair()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
