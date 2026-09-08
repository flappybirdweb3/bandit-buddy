/**
 * Verifies all three BarnBuddy contracts on BSCScan.
 *
 * Prerequisites:
 *   - BSCSCAN_API_KEY set in ../.env
 *   - Run after deploy: deployment.<network>.json must exist
 *
 * Usage:
 *   npm run verify:testnet   # reads deployment.bscTestnet.json
 *   npm run verify:mainnet   # reads deployment.bscMainnet.json
 */

import { run, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface Deployment {
  network: string;
  deployer: string;
  farmToken: string;
  farmTokenClaim: string;
  guardDogNFT: string;
}

async function verify(address: string, constructorArgs: unknown[]) {
  try {
    await run('verify:verify', {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✓ verified: ${address}`);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes('Already Verified')) {
      console.log(`  ⊙ already verified: ${address}`);
    } else {
      console.error(`  ✗ failed: ${address}\n    ${msg}`);
    }
  }
}

async function main() {
  const deployFile = path.join(__dirname, '..', `deployment.${network.name}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(
      `Deployment file not found: ${deployFile}\nRun deploy:${network.name} first.`,
    );
  }

  const d: Deployment = JSON.parse(fs.readFileSync(deployFile, 'utf8'));
  console.log(`Verifying contracts on ${network.name}…`);
  console.log(`  Deployer  : ${d.deployer}`);
  console.log(`  FarmToken : ${d.farmToken}`);
  console.log(`  Claim     : ${d.farmTokenClaim}`);
  console.log(`  GuardDog  : ${d.guardDogNFT}\n`);

  // FarmToken(address initialOwner)
  await verify(d.farmToken, [d.deployer]);

  // FarmTokenClaim(address farmToken, address signerAddress, address initialOwner)
  // signer = deployer at deploy time; adjust if you used a separate key
  const signerAddress = process.env.CLAIM_SIGNER_ADDRESS ?? d.deployer;
  await verify(d.farmTokenClaim, [d.farmToken, signerAddress, d.deployer]);

  // GuardDogNFT(address farmToken, address initialOwner, address treasury, string baseUri)
  const treasury = process.env.TREASURY_ADDRESS ?? d.deployer;
  await verify(d.guardDogNFT, [
    d.farmToken,
    d.deployer,
    treasury,
    'https://api.barnbuddy.io/nft/metadata/',
  ]);

  console.log('\nAll done.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
