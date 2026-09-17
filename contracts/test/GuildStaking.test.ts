import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { FarmToken, GuildStaking } from '../typechain-types';

describe('GuildStaking', () => {
  const ONE_DAY = 86400;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const guildId = ethers.keccak256(ethers.toUtf8Bytes('guild-alpha-123'));

  async function deployFixture() {
    const [owner, alice, bob, treasury] = await ethers.getSigners();

    const FarmF = await ethers.getContractFactory('FarmToken');
    const farm = (await FarmF.deploy(owner.address)) as unknown as FarmToken;

    const StakingF = await ethers.getContractFactory('GuildStaking');
    const staking = (await StakingF.deploy(
      await farm.getAddress(),
      owner.address,
    )) as unknown as GuildStaking;

    const stakingAddress = await staking.getAddress();

    // Fund alice and bob
    const fundAmount = ethers.parseEther('10000');
    await farm.connect(owner).transfer(alice.address, fundAmount);
    await farm.connect(owner).transfer(bob.address, fundAmount);

    // Approvals
    await farm.connect(alice).approve(stakingAddress, ethers.MaxUint256);
    await farm.connect(bob).approve(stakingAddress, ethers.MaxUint256);
    await farm.connect(owner).approve(stakingAddress, ethers.MaxUint256);

    return { farm, staking, owner, alice, bob, treasury, stakingAddress };
  }

  describe('deployment', () => {
    it('initialises correctly', async () => {
      const { staking, owner } = await loadFixture(deployFixture);
      expect(await staking.owner()).to.equal(owner.address);
      expect(await staking.minEliteStake()).to.equal(ethers.parseEther('1000'));
    });

    it('reverts on zero address in constructor', async () => {
      const { farm, owner } = await loadFixture(deployFixture);
      const StakingF = await ethers.getContractFactory('GuildStaking');
      await expect(
        StakingF.deploy(ethers.ZeroAddress, owner.address),
      ).to.be.revertedWithCustomError(StakingF, 'ZeroAddress');
      await expect(
        StakingF.deploy(await farm.getAddress(), ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(StakingF, 'OwnableInvalidOwner');
    });
  });

  describe('stake and unstake', () => {
    it('allows staking and updates totals', async () => {
      const { staking, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('100');

      await expect(staking.connect(alice).stake(guildId, amount))
        .to.emit(staking, 'Staked')
        .withArgs(guildId, alice.address, amount);

      expect(await staking.userStake(guildId, alice.address)).to.equal(amount);
      expect(await staking.guildTotalStaked(guildId)).to.equal(amount);
    });

    it('enforces 7-day cooldown on unstaking', async () => {
      const { staking, alice, farm } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('100');

      await staking.connect(alice).stake(guildId, amount);

      await expect(staking.connect(alice).requestUnstake(guildId))
        .to.emit(staking, 'UnstakeRequested')
        .withArgs(guildId, alice.address, amount);

      // Attempt immediate unstake — should revert
      await expect(staking.connect(alice).unstake(guildId))
        .to.be.revertedWithCustomError(staking, 'UnstakeLocked');

      // Fast-forward 6 days — still locked
      await time.increase(6 * ONE_DAY);
      await expect(staking.connect(alice).unstake(guildId))
        .to.be.revertedWithCustomError(staking, 'UnstakeLocked');

      // Fast-forward 1 more day + 10s — unlocked!
      await time.increase(ONE_DAY + 10);

      const balBefore = await farm.balanceOf(alice.address);
      await expect(staking.connect(alice).unstake(guildId))
        .to.emit(staking, 'Unstaked')
        .withArgs(guildId, alice.address, amount);

      const balAfter = await farm.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(amount);
      expect(await staking.userStake(guildId, alice.address)).to.equal(0n);
      expect(await staking.guildTotalStaked(guildId)).to.equal(0n);
    });
  });

  describe('harvest tax', () => {
    it('deposits and tracks harvest tax per guild', async () => {
      const { staking, alice } = await loadFixture(deployFixture);
      const taxAmount = ethers.parseEther('50');

      await expect(staking.connect(alice).depositHarvestTax(guildId, taxAmount))
        .to.emit(staking, 'HarvestTaxDeposited')
        .withArgs(guildId, alice.address, taxAmount);

      expect(await staking.guildHarvestTax(guildId)).to.equal(taxAmount);
    });

    it('allows owner to claim / distribute harvest tax to recipient', async () => {
      const { staking, alice, bob, owner, farm } = await loadFixture(deployFixture);
      const taxAmount = ethers.parseEther('80');

      await staking.connect(alice).depositHarvestTax(guildId, taxAmount);

      // Non-owner cannot claim
      await expect(
        staking.connect(alice).claimHarvestTax(guildId, bob.address, taxAmount),
      ).to.be.revertedWithCustomError(staking, 'OwnableUnauthorizedAccount');

      // Owner claims
      const bobBalBefore = await farm.balanceOf(bob.address);
      await expect(staking.connect(owner).claimHarvestTax(guildId, bob.address, taxAmount))
        .to.emit(staking, 'HarvestTaxClaimed')
        .withArgs(guildId, bob.address, taxAmount);

      const bobBalAfter = await farm.balanceOf(bob.address);
      expect(bobBalAfter - bobBalBefore).to.equal(taxAmount);
      expect(await staking.guildHarvestTax(guildId)).to.equal(0n);
    });

    it('reverts when claiming more than available tax balance', async () => {
      const { staking, alice, bob, owner } = await loadFixture(deployFixture);
      const taxAmount = ethers.parseEther('30');
      await staking.connect(alice).depositHarvestTax(guildId, taxAmount);

      await expect(
        staking.connect(owner).claimHarvestTax(guildId, bob.address, ethers.parseEther('31')),
      ).to.be.revertedWithCustomError(staking, 'InsufficientTaxBalance');
    });
  });
});
