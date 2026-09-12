import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { FarmToken, FarmTokenClaim } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Populated in beforeEach() from the freshly deployed contract. The digest is
// domain-bound to (block.chainid, address(this)), so the helper needs both values to
// mirror FarmTokenClaim.hashMessage() exactly. Signing the old 3-argument pre-image made
// every claim revert with InvalidSignature().
let claimAddress: string;
let activeChainId: bigint;

/**
 * Mirrors FarmTokenClaim.hashMessage():
 *   keccak256(abi.encodePacked(block.chainid, address(this), user, amount, nonce))
 * then applies the ERC-191 ("\x19Ethereum Signed Message:\n32") prefix via signMessage.
 *
 * Argument order matches CLAIM_DIGEST_TYPES in backend/src/modules/web3/claim-digest.ts —
 * if this drifts, claims revert rather than silently paying out.
 */
async function buildSignature(
  signer: SignerWithAddress,
  user: string,
  amount: bigint,
  nonce: number,
): Promise<string> {
  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'address', 'address', 'uint256', 'uint256'],
    [activeChainId, claimAddress, user, amount, nonce],
  );
  // signMessage adds "\x19Ethereum Signed Message:\n32" prefix
  return signer.signMessage(ethers.getBytes(messageHash));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('FarmTokenClaim', () => {
  let token: FarmToken;
  let claim: FarmTokenClaim;
  let owner: SignerWithAddress;
  let signer: SignerWithAddress; // the backend "admin wallet"
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let attacker: SignerWithAddress;

  const POOL_FUND = ethers.parseUnits('1000000', 18);
  const CLAIM_100 = ethers.parseUnits('100', 18);
  const MIN_CLAIM = ethers.parseUnits('1', 18);
  const MAX_CLAIM = ethers.parseUnits('100000', 18);

  beforeEach(async () => {
    [owner, signer, alice, bob, attacker] = await ethers.getSigners();

    // Deploy FarmToken
    const TokenFactory = await ethers.getContractFactory('FarmToken');
    token = (await TokenFactory.deploy(owner.address)) as unknown as FarmToken;
    await token.waitForDeployment();

    // Deploy FarmTokenClaim
    const ClaimFactory = await ethers.getContractFactory('FarmTokenClaim');
    claim = (await ClaimFactory.deploy(
      await token.getAddress(),
      signer.address,
      owner.address,
    )) as unknown as FarmTokenClaim;
    await claim.waitForDeployment();

    claimAddress = await claim.getAddress();
    activeChainId = (await ethers.provider.getNetwork()).chainId;

    // Fund the claim pool
    await token.approve(await claim.getAddress(), POOL_FUND);
    await claim.fundPool(POOL_FUND);
  });

  // ─── Deployment ────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('stores farmToken address', async () => {
      expect(await claim.farmToken()).to.equal(await token.getAddress());
    });
    it('stores signer address', async () => {
      expect(await claim.signerAddress()).to.equal(signer.address);
    });
    it('has correct pool balance after funding', async () => {
      expect(await claim.poolBalance()).to.equal(POOL_FUND);
    });
    it('reverts deployment with zero addresses', async () => {
      const Factory = await ethers.getContractFactory('FarmTokenClaim');
      await expect(
        Factory.deploy(ethers.ZeroAddress, signer.address, owner.address),
      ).to.be.reverted;
    });
  });

  // ─── Happy path claim ──────────────────────────────────────────────────

  describe('claimTokens – success path', () => {
    it('transfers FARM to user on valid signature', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      const before = await token.balanceOf(alice.address);

      await claim.connect(alice).claimTokens(CLAIM_100, 0, sig);

      expect(await token.balanceOf(alice.address)).to.equal(before + CLAIM_100);
    });

    it('reduces pool balance by claimed amount', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await claim.connect(alice).claimTokens(CLAIM_100, 0, sig);
      expect(await claim.poolBalance()).to.equal(POOL_FUND - CLAIM_100);
    });

    it('marks nonce as used after claim', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await claim.connect(alice).claimTokens(CLAIM_100, 0, sig);
      expect(await claim.isNonceUsed(alice.address, 0)).to.be.true;
    });

    it('increments totalClaimed', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await claim.connect(alice).claimTokens(CLAIM_100, 0, sig);
      expect(await claim.totalClaimed()).to.equal(CLAIM_100);
    });

    it('emits TokensClaimed event', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(claim.connect(alice).claimTokens(CLAIM_100, 0, sig))
        .to.emit(claim, 'TokensClaimed')
        .withArgs(alice.address, CLAIM_100, 0n, (ts: bigint) => ts > 0n);
    });

    it('allows sequential claims with increasing nonces', async () => {
      for (let nonce = 0; nonce < 5; nonce++) {
        const sig = await buildSignature(signer, alice.address, CLAIM_100, nonce);
        await claim.connect(alice).claimTokens(CLAIM_100, nonce, sig);
      }
      expect(await token.balanceOf(alice.address)).to.equal(CLAIM_100 * 5n);
    });

    it('allows different users to claim independently', async () => {
      const sigA = await buildSignature(signer, alice.address, CLAIM_100, 0);
      const sigB = await buildSignature(signer, bob.address, CLAIM_100, 0);
      await claim.connect(alice).claimTokens(CLAIM_100, 0, sigA);
      await claim.connect(bob).claimTokens(CLAIM_100, 0, sigB);
      expect(await token.balanceOf(alice.address)).to.equal(CLAIM_100);
      expect(await token.balanceOf(bob.address)).to.equal(CLAIM_100);
    });
  });

  // ─── Replay attack prevention ───────────────────────────────────────────

  describe('replay protection', () => {
    it('reverts on duplicate nonce', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await claim.connect(alice).claimTokens(CLAIM_100, 0, sig);

      // Same sig, same nonce – must fail
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'NonceAlreadyUsed');
    });

    it("cannot reuse alice's signature as bob", async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      // Bob tries to submit alice's sig with his own address – sig will be invalid
      await expect(
        claim.connect(bob).claimTokens(CLAIM_100, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'InvalidSignature');
    });
  });

  // ─── Signature validation ───────────────────────────────────────────────

  describe('signature validation', () => {
    it('rejects signature from wrong signer', async () => {
      const fakeSig = await buildSignature(attacker, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, fakeSig),
      ).to.be.revertedWithCustomError(claim, 'InvalidSignature');
    });

    it('rejects tampered amount', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      const tamperedAmount = ethers.parseUnits('200', 18);
      await expect(
        claim.connect(alice).claimTokens(tamperedAmount, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'InvalidSignature');
    });

    it('rejects tampered nonce', async () => {
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 99, sig),
      ).to.be.revertedWithCustomError(claim, 'InvalidSignature');
    });

    it('hashMessage view matches backend computation', async () => {
      const { messageHash, ethSignedHash } = await claim.hashMessage(alice.address, CLAIM_100, 0);
      const expectedHash = ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'address', 'uint256', 'uint256'],
        [activeChainId, claimAddress, alice.address, CLAIM_100, 0],
      );
      expect(messageHash).to.equal(expectedHash);
      expect(ethSignedHash).to.equal(
        ethers.hashMessage(ethers.getBytes(expectedHash)),
      );
    });
  });

  // ─── Claim bounds ───────────────────────────────────────────────────────

  describe('claim bounds', () => {
    it('reverts when amount below minClaimAmount', async () => {
      const dustAmount = ethers.parseUnits('0.5', 18);
      const sig = await buildSignature(signer, alice.address, dustAmount, 0);
      await expect(
        claim.connect(alice).claimTokens(dustAmount, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'AmountOutOfBounds');
    });

    it('reverts when amount above maxClaimAmount', async () => {
      const huge = ethers.parseUnits('200000', 18);
      const sig = await buildSignature(signer, alice.address, huge, 0);
      await expect(
        claim.connect(alice).claimTokens(huge, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'AmountOutOfBounds');
    });

    it('owner can update claim bounds', async () => {
      const newMin = ethers.parseUnits('10', 18);
      const newMax = ethers.parseUnits('50000', 18);
      await expect(claim.setClaimBounds(newMin, newMax))
        .to.emit(claim, 'ClaimBoundsUpdated')
        .withArgs(newMin, newMax);
      expect(await claim.minClaimAmount()).to.equal(newMin);
      expect(await claim.maxClaimAmount()).to.equal(newMax);
    });
  });

  // ─── Pool balance guard ─────────────────────────────────────────────────

  describe('pool balance', () => {
    it('reverts when pool is underfunded', async () => {
      // Drain the pool first via emergency withdrawal
      await claim.emergencyWithdraw(POOL_FUND);

      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, sig),
      ).to.be.revertedWithCustomError(claim, 'InsufficientPoolBalance');
    });
  });

  // ─── Pause ─────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('owner can pause claims', async () => {
      await claim.pause();
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, sig),
      ).to.be.reverted;
    });

    it('claims work again after unpause', async () => {
      await claim.pause();
      await claim.unpause();
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, sig),
      ).to.not.be.reverted;
    });

    it('non-owner cannot pause', async () => {
      await expect(claim.connect(alice).pause()).to.be.reverted;
    });
  });

  // ─── Admin ops ──────────────────────────────────────────────────────────

  describe('admin operations', () => {
    it('owner can rotate signer', async () => {
      const newSigner = bob;
      await expect(claim.setSigner(newSigner.address))
        .to.emit(claim, 'SignerUpdated')
        .withArgs(signer.address, newSigner.address);

      // Old signer sig should now fail
      const oldSig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, oldSig),
      ).to.be.revertedWithCustomError(claim, 'InvalidSignature');

      // New signer sig should work
      const newSig = await buildSignature(newSigner, alice.address, CLAIM_100, 0);
      await expect(
        claim.connect(alice).claimTokens(CLAIM_100, 0, newSig),
      ).to.not.be.reverted;
    });

    it('non-owner cannot set signer', async () => {
      await expect(
        claim.connect(alice).setSigner(bob.address),
      ).to.be.reverted;
    });

    it('setSigner reverts on zero address', async () => {
      await expect(
        claim.setSigner(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(claim, 'ZeroAddress');
    });

    it('owner can emergency withdraw', async () => {
      const before = await token.balanceOf(owner.address);
      await claim.emergencyWithdraw(POOL_FUND);
      expect(await token.balanceOf(owner.address)).to.equal(before + POOL_FUND);
      expect(await claim.poolBalance()).to.equal(0n);
    });

    it('non-owner cannot emergency withdraw', async () => {
      await expect(
        claim.connect(alice).emergencyWithdraw(CLAIM_100),
      ).to.be.reverted;
    });
  });

  // ─── Exact boundary claims ──────────────────────────────────────────────

  describe('boundary claims', () => {
    it('accepts a claim of exactly minClaimAmount', async () => {
      const sig = await buildSignature(signer, alice.address, MIN_CLAIM, 0);
      await expect(claim.connect(alice).claimTokens(MIN_CLAIM, 0, sig)).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(MIN_CLAIM);
    });

    it('accepts a claim of exactly maxClaimAmount', async () => {
      // Pool holds POOL_FUND (1,000,000) so the 100k max claim is fully covered.
      const sig = await buildSignature(signer, alice.address, MAX_CLAIM, 0);
      await expect(claim.connect(alice).claimTokens(MAX_CLAIM, 0, sig)).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(MAX_CLAIM);
      expect(await claim.poolBalance()).to.equal(POOL_FUND - MAX_CLAIM);
    });
  });

  // ─── Pause semantics (explicit custom error) ────────────────────────────

  describe('pause custom error', () => {
    it('reverts with EnforcedPause rather than a bare revert', async () => {
      await claim.pause();
      const sig = await buildSignature(signer, alice.address, CLAIM_100, 0);
      await expect(claim.connect(alice).claimTokens(CLAIM_100, 0, sig))
        .to.be.revertedWithCustomError(claim, 'EnforcedPause');
    });
  });
});
