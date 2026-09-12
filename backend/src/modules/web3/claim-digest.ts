import { ethers } from 'ethers';

/**
 * Backend half of the FarmTokenClaim signature domain.
 *
 * FarmTokenClaim.hashMessage() computes:
 *
 *   keccak256(abi.encodePacked(block.chainid, address(this), user, amount, nonce))
 *
 * and verifies the ERC-191 wrapped form of it. Binding (chainid, address(this)) is what
 * makes a testnet signature un-replayable on mainnet, or against a redeployed instance,
 * even when the backend signer key is shared.
 *
 * Argument ORDER is load-bearing: change it here and it must change in the contract in the
 * same release, or every claim reverts with InvalidSignature. claim-digest.spec.ts pins the
 * layout so a silent reordering cannot ship.
 */

/** ABI types of the packed pre-image, in order. Exported so tests can pin the layout. */
export const CLAIM_DIGEST_TYPES: readonly string[] = [
  'uint256', // block.chainid
  'address', // address(this) — the FarmTokenClaim deployment
  'address', // user / msg.sender
  'uint256', // amount in wei
  'uint256', // per-user nonce
];

/**
 * Build the 32-byte digest that must be signed.
 *
 * The "\x19Ethereum Signed Message:\n32" prefix is deliberately NOT applied here — it is
 * added by Wallet.signMessage(), exactly mirroring the contract's
 * MessageHashUtils.toEthSignedMessageHash() on the verification side.
 */
export function buildClaimDigest(
  chainId: bigint,
  claimContract: string,
  userAddress: string,
  amountWei: bigint,
  nonce: number | bigint,
): string {
  return ethers.solidityPackedKeccak256(CLAIM_DIGEST_TYPES, [
    chainId,
    claimContract,
    userAddress,
    amountWei,
    nonce,
  ]);
}
