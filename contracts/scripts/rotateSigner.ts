/**
 * Rotates the backend signer key on FarmTokenClaim.
 *
 * Use during incident response or scheduled key rotation.
 * The new signer address MUST match the private key loaded into
 * the backend's SIGNER_PRIVATE_KEY env var before running this script,
 * otherwise all subsequent claim signatures will be invalid.
 *
 * Prerequisites:
 *   - SIGNER_PRIVATE_KEY (current owner key) set in ../.env
 *   - NEW_SIGNER_ADDRESS env var set to the new backend wallet address
 *   - deployment.<network>.json must exist
 *
 * Usage:
 *   NEW_SIGNER_ADDRESS=0xABC... npm run rotate-signer
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [owner] = await ethers.getSigners();

  const newSigner = process.env.NEW_SIGNER_ADDRESS;
  if (!newSigner || !ethers.isAddress(newSigner)) {
    throw new Error('Set NEW_SIGNER_ADDRESS=0x... before running this script');
  }

  const deployFile = path.join(__dirname, '..', `deployment.${network.name}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`Deployment file not found: ${deployFile}`);
  }
  const d = JSON.parse(fs.readFileSync(deployFile, 'utf8'));

  const claimContract = await ethers.getContractAt('FarmTokenClaim', d.farmTokenClaim, owner);

  const currentSigner = await claimContract.signerAddress();
  console.log(`Network       : ${network.name}`);
  console.log(`Claim contract: ${d.farmTokenClaim}`);
  console.log(`Owner         : ${owner.address}`);
  console.log(`Current signer: ${currentSigner}`);
  console.log(`New signer    : ${newSigner}`);

  if (currentSigner.toLowerCase() === newSigner.toLowerCase()) {
    console.log('\nSigner is already set to this address — nothing to do.');
    return;
  }

  const tx = await claimContract.setSigner(newSigner);
  const receipt = await tx.wait();
  console.log(`\nSigner rotated in tx: ${receipt?.hash}`);
  console.log('Update CLAIM_SIGNER_ADDRESS in your backend .env and restart the backend.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
