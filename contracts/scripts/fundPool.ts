/**
 * Adds more FARM tokens to the FarmTokenClaim pool.
 *
 * Prerequisites:
 *   - Deployer wallet must hold enough FARM
 *   - SIGNER_PRIVATE_KEY set in ../.env
 *   - deployment.<network>.json must exist
 *
 * Usage:
 *   FUND_AMOUNT=500000 npm run fund-pool
 *   (defaults to 100,000 FARM if FUND_AMOUNT not set)
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();

  const deployFile = path.join(__dirname, '..', `deployment.${network.name}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`Deployment file not found: ${deployFile}`);
  }
  const d = JSON.parse(fs.readFileSync(deployFile, 'utf8'));

  const amountStr = process.env.FUND_AMOUNT ?? '100000';
  const amount = ethers.parseUnits(amountStr, 18);

  const farmToken = await ethers.getContractAt('FarmToken', d.farmToken, deployer);
  const claimContract = await ethers.getContractAt('FarmTokenClaim', d.farmTokenClaim, deployer);

  const balance = await farmToken.balanceOf(deployer.address);
  if (balance < amount) {
    throw new Error(
      `Insufficient FARM: have ${ethers.formatUnits(balance, 18)}, need ${amountStr}`,
    );
  }

  console.log(`Network  : ${network.name}`);
  console.log(`Funder   : ${deployer.address}`);
  console.log(`Amount   : ${amountStr} FARM`);
  console.log(`Claim    : ${d.farmTokenClaim}`);

  const poolBefore = await claimContract.poolBalance();
  console.log(`Pool before: ${ethers.formatUnits(poolBefore, 18)} FARM`);

  // Approve then fund
  const approveTx = await farmToken.approve(d.farmTokenClaim, amount);
  await approveTx.wait();
  console.log(`Approved transfer`);

  const fundTx = await claimContract.fundPool(amount);
  await fundTx.wait();
  console.log(`Pool funded`);

  const poolAfter = await claimContract.poolBalance();
  console.log(`Pool after : ${ethers.formatUnits(poolAfter, 18)} FARM`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
