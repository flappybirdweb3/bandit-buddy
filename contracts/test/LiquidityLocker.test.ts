import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { LiquidityLocker, MockERC20 } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const TOKENS = (n: number) => ethers.parseUnits(String(n), 18);
const SIX_MONTHS = 15_552_000; // seconds
const ONE_YEAR   = SIX_MONTHS * 2;

describe('LiquidityLocker', () => {
  let locker: LiquidityLocker;
  let lp: MockERC20;
  let owner: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async () => {
    [owner, beneficiary, stranger] = await ethers.getSigners();

    const LpFactory = await ethers.getContractFactory('MockERC20');
    lp = (await LpFactory.deploy()) as unknown as MockERC20;
    await lp.waitForDeployment();
    await lp.mint(owner.address, TOKENS(1_000_000));

    const Factory = await ethers.getContractFactory('LiquidityLocker');
    locker = (await Factory.deploy(owner.address)) as unknown as LiquidityLocker;
    await locker.waitForDeployment();

    // Pre-approve locker to pull LP tokens from owner
    await lp.approve(await locker.getAddress(), TOKENS(1_000_000));
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('sets owner correctly', async () => {
      expect(await locker.owner()).to.equal(owner.address);
    });

    it('exposes MIN_LOCK_DURATION = 6 months', async () => {
      expect(await locker.MIN_LOCK_DURATION()).to.equal(SIX_MONTHS);
    });

    it('starts with zero locks', async () => {
      expect(await locker.lockCount()).to.equal(0);
      expect((await locker.getActiveLocks()).length).to.equal(0);
    });
  });

  // ── lockTokens ─────────────────────────────────────────────────────────────

  describe('lockTokens()', () => {
    it('locks tokens and emits TokensLocked', async () => {
      const amount = TOKENS(1000);
      const tx = await locker.lockTokens(
        await lp.getAddress(), amount, ONE_YEAR, beneficiary.address,
      );

      await expect(tx).to.emit(locker, 'TokensLocked');
      expect(await locker.lockCount()).to.equal(1);
      expect(await lp.balanceOf(await locker.getAddress())).to.equal(amount);
    });

    it('stores correct lock metadata', async () => {
      const amount = TOKENS(500);
      await locker.lockTokens(await lp.getAddress(), amount, ONE_YEAR, beneficiary.address);

      const lock = await locker.getLock(0);
      expect(lock.token).to.equal(await lp.getAddress());
      expect(lock.amount).to.equal(amount);
      expect(lock.beneficiary).to.equal(beneficiary.address);
      expect(lock.withdrawn).to.equal(false);

      const block = await ethers.provider.getBlock('latest');
      expect(lock.unlockTime).to.be.closeTo(BigInt(block!.timestamp) + BigInt(ONE_YEAR), 5n);
    });

    it('reverts if duration is less than 6 months', async () => {
      await expect(
        locker.lockTokens(await lp.getAddress(), TOKENS(1000), SIX_MONTHS - 1, beneficiary.address),
      ).to.be.revertedWithCustomError(locker, 'TooShort');
    });

    it('reverts on zero amount', async () => {
      await expect(
        locker.lockTokens(await lp.getAddress(), 0, ONE_YEAR, beneficiary.address),
      ).to.be.revertedWithCustomError(locker, 'ZeroAmount');
    });

    it('reverts if caller is not owner', async () => {
      await lp.approve(await locker.getAddress(), TOKENS(1000));
      await expect(
        locker.connect(stranger).lockTokens(await lp.getAddress(), TOKENS(100), ONE_YEAR, beneficiary.address),
      ).to.be.reverted;
    });

    it('can create multiple locks', async () => {
      await locker.lockTokens(await lp.getAddress(), TOKENS(100), ONE_YEAR, beneficiary.address);
      await locker.lockTokens(await lp.getAddress(), TOKENS(200), ONE_YEAR, stranger.address);
      expect(await locker.lockCount()).to.equal(2);
    });
  });

  // ── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw()', () => {
    beforeEach(async () => {
      await locker.lockTokens(await lp.getAddress(), TOKENS(1000), ONE_YEAR, beneficiary.address);
    });

    it('reverts before unlock time', async () => {
      await expect(locker.connect(beneficiary).withdraw(0))
        .to.be.revertedWithCustomError(locker, 'NotYet');
    });

    it('reverts when caller is not the beneficiary', async () => {
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);
      await expect(locker.connect(stranger).withdraw(0))
        .to.be.revertedWithCustomError(locker, 'NotBeneficiary');
    });

    it('transfers tokens to beneficiary after unlock time', async () => {
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);

      const before = await lp.balanceOf(beneficiary.address);
      await locker.connect(beneficiary).withdraw(0);
      const after = await lp.balanceOf(beneficiary.address);

      expect(after - before).to.equal(TOKENS(1000));
    });

    it('marks lock as withdrawn', async () => {
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);

      await locker.connect(beneficiary).withdraw(0);
      const lock = await locker.getLock(0);
      expect(lock.withdrawn).to.equal(true);
    });

    it('emits TokensWithdrawn', async () => {
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);

      await expect(locker.connect(beneficiary).withdraw(0))
        .to.emit(locker, 'TokensWithdrawn')
        .withArgs(0, TOKENS(1000));
    });

    it('reverts on double-withdraw', async () => {
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);

      await locker.connect(beneficiary).withdraw(0);
      await expect(locker.connect(beneficiary).withdraw(0))
        .to.be.revertedWithCustomError(locker, 'AlreadyWithdrawn');
    });
  });

  // ── getActiveLocks ─────────────────────────────────────────────────────────

  describe('getActiveLocks()', () => {
    it('returns only non-withdrawn locks', async () => {
      await locker.lockTokens(await lp.getAddress(), TOKENS(100), ONE_YEAR, beneficiary.address);
      await locker.lockTokens(await lp.getAddress(), TOKENS(200), ONE_YEAR, beneficiary.address);

      expect((await locker.getActiveLocks()).length).to.equal(2);

      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);
      await locker.connect(beneficiary).withdraw(0);

      const active = await locker.getActiveLocks();
      expect(active.length).to.equal(1);
      expect(active[0].amount).to.equal(TOKENS(200));
    });

    it('returns empty array when all locks are withdrawn', async () => {
      await locker.lockTokens(await lp.getAddress(), TOKENS(100), ONE_YEAR, beneficiary.address);
      await ethers.provider.send('evm_increaseTime', [ONE_YEAR + 1]);
      await ethers.provider.send('evm_mine', []);
      await locker.connect(beneficiary).withdraw(0);

      expect((await locker.getActiveLocks()).length).to.equal(0);
    });
  });

  // ── Minimum 6-month boundary ────────────────────────────────────────────────

  describe('exact 6-month boundary', () => {
    it('accepts exactly 6 months', async () => {
      await expect(
        locker.lockTokens(await lp.getAddress(), TOKENS(100), SIX_MONTHS, beneficiary.address),
      ).to.not.be.reverted;
    });

    it('rejects one second below 6 months', async () => {
      await expect(
        locker.lockTokens(await lp.getAddress(), TOKENS(100), SIX_MONTHS - 1, beneficiary.address),
      ).to.be.revertedWithCustomError(locker, 'TooShort');
    });
  });
});
