import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';

describe('BarnServices — In-App BNB Revenue Engine', () => {
  async function deployFixture() {
    const [owner, player1, player2, treasury] = await ethers.getSigners();

    const BarnServicesFactory = await ethers.getContractFactory('BarnServices');
    const barnServices = await BarnServicesFactory.deploy(treasury.address, owner.address);

    return { barnServices, owner, player1, player2, treasury };
  }

  describe('Configuration & Deployment', () => {
    it('sets initial parameters correctly', async () => {
      const { barnServices, treasury } = await loadFixture(deployFixture);

      expect(await barnServices.treasury()).to.equal(treasury.address);
      expect(await barnServices.subscriptionPrices(1)).to.equal(ethers.parseEther('0.005'));
      expect(await barnServices.subscriptionPrices(2)).to.equal(ethers.parseEther('0.015'));
      expect(await barnServices.subscriptionDurations(1)).to.equal(7n * 86400n);
      expect(await barnServices.subscriptionDurations(2)).to.equal(30n * 86400n);
    });

    it('reverts deployment with zero treasury address', async () => {
      const [owner] = await ethers.getSigners();
      const BarnServicesFactory = await ethers.getContractFactory('BarnServices');
      await expect(
        BarnServicesFactory.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWithCustomError(BarnServicesFactory, 'ZeroAddress');
    });
  });

  describe('purchasePremiumSubscription', () => {
    it('purchases 7-day subscription: transfers 0.005 BNB directly to Treasury', async () => {
      const { barnServices, player1, treasury } = await loadFixture(deployFixture);

      const price = ethers.parseEther('0.005');
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const tx = await barnServices.connect(player1).purchasePremiumSubscription(1, { value: price });
      await expect(tx)
        .to.emit(barnServices, 'SubscriptionPurchased')
        .withArgs(player1.address, 1, (expiry: bigint) => expiry > 0n, price);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(price);

      const isActive = await barnServices.isSubscriptionActive(player1.address, 1);
      expect(isActive).to.equal(true);
    });

    it('purchases 30-day subscription: transfers 0.015 BNB directly to Treasury', async () => {
      const { barnServices, player1, treasury } = await loadFixture(deployFixture);

      const price = ethers.parseEther('0.015');
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await barnServices.connect(player1).purchasePremiumSubscription(2, { value: price });

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(price);

      const expiry = await barnServices.getSubscriptionExpiry(player1.address, 2);
      const now = BigInt(await time.latest());
      expect(expiry).to.be.closeTo(now + 30n * 86400n, 10n);
    });

    it('stacks duration when renewing an active subscription', async () => {
      const { barnServices, player1 } = await loadFixture(deployFixture);

      await barnServices.connect(player1).purchasePremiumSubscription(1, { value: ethers.parseEther('0.005') });
      const firstExpiry = await barnServices.getSubscriptionExpiry(player1.address, 1);

      await barnServices.connect(player1).purchasePremiumSubscription(1, { value: ethers.parseEther('0.005') });
      const secondExpiry = await barnServices.getSubscriptionExpiry(player1.address, 1);

      expect(secondExpiry).to.equal(firstExpiry + 7n * 86400n);
    });

    it('reverts when sending insufficient BNB', async () => {
      const { barnServices, player1 } = await loadFixture(deployFixture);

      await expect(
        barnServices.connect(player1).purchasePremiumSubscription(1, { value: ethers.parseEther('0.002') })
      ).to.be.revertedWithCustomError(barnServices, 'InsufficientBnb');
    });

    it('reverts on invalid subType', async () => {
      const { barnServices, player1 } = await loadFixture(deployFixture);

      await expect(
        barnServices.connect(player1).purchasePremiumSubscription(99, { value: ethers.parseEther('0.05') })
      ).to.be.revertedWithCustomError(barnServices, 'InvalidSubType');
    });
  });

  describe('Admin Operations', () => {
    it('allows owner to update subscription config', async () => {
      const { barnServices, owner } = await loadFixture(deployFixture);

      await barnServices.connect(owner).setSubscriptionConfig(3, ethers.parseEther('0.02'), 60n * 86400n);
      expect(await barnServices.subscriptionPrices(3)).to.equal(ethers.parseEther('0.02'));
      expect(await barnServices.subscriptionDurations(3)).to.equal(60n * 86400n);
    });

    it('allows owner to update treasury address', async () => {
      const { barnServices, owner, player2 } = await loadFixture(deployFixture);

      await barnServices.connect(owner).setTreasury(player2.address);
      expect(await barnServices.treasury()).to.equal(player2.address);
    });

    it('pauses and unpauses subscription purchases', async () => {
      const { barnServices, owner, player1 } = await loadFixture(deployFixture);

      await barnServices.connect(owner).pause();
      await expect(
        barnServices.connect(player1).purchasePremiumSubscription(1, { value: ethers.parseEther('0.005') })
      ).to.be.revertedWithCustomError(barnServices, 'EnforcedPause');

      await barnServices.connect(owner).unpause();
      await expect(
        barnServices.connect(player1).purchasePremiumSubscription(1, { value: ethers.parseEther('0.005') })
      ).to.not.be.reverted;
    });
  });
});
