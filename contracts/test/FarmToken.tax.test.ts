import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const parse = (n: number | string) => ethers.parseUnits(String(n), 18);
const TIER2 = parse(10_000);
const TIER3 = parse(50_000);

describe('FarmToken — holdings-based tiered tax', () => {
  async function deployFixture() {
    const [owner, alice, bob, pair, treasury] = await ethers.getSigners();
    const farm = await (await ethers.getContractFactory('FarmToken')).deploy(owner.address);
    await farm.connect(owner).setPancakePair(pair.address);
    await farm.connect(owner).setTreasuryBuybackPool(treasury.address);
    await farm.connect(owner).transfer(pair.address, parse(1_000_000));
    return { farm, owner, alice, bob, pair, treasury };
  }

  describe('getTierOf — based on wallet balance, not pool', () => {
    it('accurately maps wallet balance to tiers 1, 2, 3', async () => {
      const { farm, owner, alice } = await loadFixture(deployFixture);

      expect(await farm.getTierOf(alice.address)).to.equal(1n);

      await farm.connect(owner).transfer(alice.address, TIER2 - 1n);
      expect(await farm.getTierOf(alice.address)).to.equal(1n);

      await farm.connect(owner).transfer(alice.address, 1n);
      expect(await farm.getTierOf(alice.address)).to.equal(2n);

      await farm.connect(owner).transfer(alice.address, TIER3 - TIER2 - 1n);
      expect(await farm.getTierOf(alice.address)).to.equal(2n);

      await farm.connect(owner).transfer(alice.address, 1n);
      expect(await farm.getTierOf(alice.address)).to.equal(3n);
    });
  });

  describe('Buy direction (pair → wallet)', () => {
    it('collects 3% tax from tier-1 buyer and transfers to treasury pool', async () => {
      const { farm, pair, alice, treasury } = await loadFixture(deployFixture);
      const amount = parse(1_000);
      const tax = (amount * 300n) / 10_000n;

      const aliceBefore = await farm.balanceOf(alice.address);
      const treasuryBefore = await farm.balanceOf(treasury.address);

      await expect(farm.connect(pair).transfer(alice.address, amount))
        .to.emit(farm, 'TaxCollected')
        .withArgs(pair.address, treasury.address, tax);

      expect(await farm.balanceOf(alice.address)).to.equal(aliceBefore + amount - tax);
      expect(await farm.balanceOf(treasury.address)).to.equal(treasuryBefore + tax);
    });

    it('calculates tier based on balance BEFORE transaction: whale pays lower tax than minnow', async () => {
      const { farm, owner, pair, alice, bob } = await loadFixture(deployFixture);
      const amount = parse(1_000);

      // Alice is a whale (>= tier3Balance)
      await farm.connect(owner).transfer(alice.address, TIER3);
      expect(await farm.getTierOf(alice.address)).to.equal(3n);

      const tBefore = await farm.balanceOf(await farm.treasuryBuybackPool());
      await farm.connect(pair).transfer(alice.address, amount);
      const whaleTax = (await farm.balanceOf(await farm.treasuryBuybackPool())) - tBefore;

      const tBefore2 = await farm.balanceOf(await farm.treasuryBuybackPool());
      await farm.connect(pair).transfer(bob.address, amount);
      const minnowTax = (await farm.balanceOf(await farm.treasuryBuybackPool())) - tBefore2;

      expect(whaleTax).to.equal((amount * 100n) / 10_000n); // 1% (Tier 3)
      expect(minnowTax).to.equal((amount * 300n) / 10_000n); // 3% (Tier 1)
      expect(whaleTax).to.be.lessThan(minnowTax);
    });
  });

  describe('Sell direction (wallet → pair)', () => {
    it('collects 5% tax from tier-1 seller', async () => {
      const { farm, owner, pair, alice, treasury } = await loadFixture(deployFixture);
      const amount = parse(1_000);
      await farm.connect(owner).transfer(alice.address, amount);

      const tax = (amount * 500n) / 10_000n;
      const pairBefore = await farm.balanceOf(pair.address);
      const treasuryBefore = await farm.balanceOf(treasury.address);

      await farm.connect(alice).transfer(pair.address, amount);

      expect(await farm.balanceOf(pair.address)).to.equal(pairBefore + amount - tax);
      expect(await farm.balanceOf(treasury.address)).to.equal(treasuryBefore + tax);
    });
  });

  describe('Security and exceptions', () => {
    it('reverts taxed transaction when treasury pool is not set', async () => {
      const [owner, alice, pair] = await ethers.getSigners();
      const farm = await (await ethers.getContractFactory('FarmToken')).deploy(owner.address);
      await farm.connect(owner).setPancakePair(pair.address);
      await farm.connect(owner).transfer(pair.address, parse(1_000));

      await expect(farm.connect(pair).transfer(alice.address, parse(100)))
        .to.be.revertedWith('FarmToken: treasury not set');
    });

    it('completely blocks all token transfers when paused (Kill Switch)', async () => {
      const { farm, owner, alice } = await loadFixture(deployFixture);

      await expect(farm.connect(owner).pause())
        .to.emit(farm, 'EmergencyPause').withArgs(owner.address);

      await expect(farm.connect(owner).transfer(alice.address, 1n))
        .to.be.revertedWithCustomError(farm, 'EnforcedPause');

      await farm.connect(owner).unpause();
      await farm.connect(owner).transfer(alice.address, 1n);
      expect(await farm.balanceOf(alice.address)).to.equal(1n);
    });
  });
});