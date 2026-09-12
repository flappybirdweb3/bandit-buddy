import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { FarmToken } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('FarmToken', () => {
  let token: FarmToken;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const MAX_SUPPLY = ethers.parseUnits('1000000000', 18); // 1 billion

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FarmToken');
    token = (await Factory.deploy(owner.address)) as unknown as FarmToken;
    await token.waitForDeployment();
  });

  // ─── Deployment ──────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('has correct name and symbol', async () => {
      expect(await token.name()).to.equal('Farm Token');
      expect(await token.symbol()).to.equal('FARM');
    });

    it('mints full supply to deployer', async () => {
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await token.balanceOf(owner.address)).to.equal(MAX_SUPPLY);
    });

    it('sets MAX_SUPPLY constant correctly', async () => {
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it('owner is deployer', async () => {
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  // ─── Transfers ───────────────────────────────────────────────────────────

  describe('transfers', () => {
    it('allows normal transfer', async () => {
      const amount = ethers.parseUnits('1000', 18);
      await token.transfer(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it('reverts transfer with insufficient balance', async () => {
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.reverted;
    });
  });

  // ─── Burn ─────────────────────────────────────────────────────────────

  describe('burn', () => {
    it('allows token holder to burn', async () => {
      const burnAmount = ethers.parseUnits('5000', 18);
      await token.burn(burnAmount);
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(MAX_SUPPLY - burnAmount);
    });

    it('allows burnFrom with allowance', async () => {
      const amount = ethers.parseUnits('1000', 18);
      await token.transfer(alice.address, amount);
      await token.connect(alice).approve(bob.address, amount);
      await token.connect(bob).burnFrom(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
    });
  });

  // ─── Pause ────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('owner can pause and unpause', async () => {
      await token.pause();
      expect(await token.paused()).to.be.true;
      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it('non-owner cannot pause', async () => {
      await expect(token.connect(alice).pause()).to.be.reverted;
    });

    it('transfer reverts when paused', async () => {
      await token.pause();
      await expect(
        token.transfer(alice.address, 1n)
      ).to.be.reverted;
    });

    it('transfer works again after unpause', async () => {
      const amount = ethers.parseUnits('100', 18);
      await token.pause();
      await token.unpause();
      await expect(token.transfer(alice.address, amount)).to.not.be.reverted;
    });
  });

  // ─── Permit (EIP-2612) ────────────────────────────────────────────────

  describe('permit', () => {
    it('supports DOMAIN_SEPARATOR', async () => {
      const ds = await token.DOMAIN_SEPARATOR();
      expect(ds).to.match(/^0x[0-9a-f]{64}$/i);
    });

    it('allows gasless approval via permit', async () => {
      const amount = ethers.parseUnits('500', 18);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = await token.nonces(owner.address);

      const domain = {
        name: 'Farm Token',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };
      const value = { owner: owner.address, spender: alice.address, value: amount, nonce, deadline };
      const sig = await owner.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      await token.permit(owner.address, alice.address, amount, deadline, v, r, s);
      expect(await token.allowance(owner.address, alice.address)).to.equal(amount);
    });
  });

  // ─── Tiered tax (holdings-based) ───────────────────────────────────────
  //
  // Pins the model documented in FarmToken.sol:
  //   tier = f(balanceOf(wallet)) — the *holder's* balance, NOT the pool's.
  //   tier1 < 10,000 FARM · tier2 < 50,000 FARM · tier3 >= 50,000 FARM
  //   buy 3% / 2% / 1%  ·  sell 5% / 3% / 1.5%  ·  hard cap 500 bps (5%)
  //
  // game_report.md claimed a pool-balance model with 500k/2M thresholds; these
  // assertions exist so that wrong assumption cannot silently come back.
  describe('tiered tax (holdings-based)', () => {
    const TIER2 = ethers.parseUnits('10000', 18);
    const TIER3 = ethers.parseUnits('50000', 18);

    async function taxFixture() {
      const [deployer, holder, pair, treasury] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('FarmToken');
      const t = (await Factory.deploy(deployer.address)) as any;
      await t.waitForDeployment();
      await t.connect(deployer).setPancakePair(pair.address);
      await t.connect(deployer).setTreasuryBuybackPool(treasury.address);
      // Seed the counter-party (a plain EOA standing in for the Pancake pair).
      await t.connect(deployer).transfer(pair.address, ethers.parseUnits('500000', 18));
      return { t, deployer, holder, pair, treasury };
    }

    it('exposes the documented thresholds and rates', async () => {
      const { t } = await taxFixture();

      expect(await t.tier2Balance()).to.equal(TIER2);
      expect(await t.tier3Balance()).to.equal(TIER3);
      expect(await t.buyTax1()).to.equal(300n);
      expect(await t.buyTax2()).to.equal(200n);
      expect(await t.buyTax3()).to.equal(100n);
      expect(await t.sellTax1()).to.equal(500n);
      expect(await t.sellTax2()).to.equal(300n);
      expect(await t.sellTax3()).to.equal(150n);
      expect(await t.MAX_TAX_BPS()).to.equal(500n);
    });

    it('maps wallet balances to tiers at the exact boundaries', async () => {
      const { t, deployer, holder } = await taxFixture();

      expect(await t.getTierOf(holder.address)).to.equal(1n);

      await t.connect(deployer).transfer(holder.address, TIER2 - 1n);
      expect(await t.getTierOf(holder.address)).to.equal(1n);

      await t.connect(deployer).transfer(holder.address, 1n); // == tier2Balance
      expect(await t.getTierOf(holder.address)).to.equal(2n);

      await t.connect(deployer).transfer(holder.address, TIER3 - TIER2 - 1n);
      expect(await t.getTierOf(holder.address)).to.equal(2n);

      await t.connect(deployer).transfer(holder.address, 1n); // == tier3Balance
      expect(await t.getTierOf(holder.address)).to.equal(3n);
    });

    it('taxes a tier-1 buy at 3% and routes it to the treasury pool', async () => {
      const { t, holder, pair, treasury } = await taxFixture();

      const amount = ethers.parseUnits('1000', 18);
      const tax = (amount * 300n) / 10_000n;
      const treasuryBefore = await t.balanceOf(treasury.address);

      await expect(t.connect(pair).transfer(holder.address, amount))
        .to.emit(t, 'TaxCollected')
        .withArgs(pair.address, treasury.address, tax);

      expect(await t.balanceOf(holder.address)).to.equal(amount - tax);
      expect(await t.balanceOf(treasury.address)).to.equal(treasuryBefore + tax);
    });

    it('taxes a tier-3 buy at 1% while a fresh wallet pays 3%', async () => {
      const { t, deployer, holder, pair, treasury } = await taxFixture();
      const minnow = (await ethers.getSigners())[4];

      await t.connect(deployer).transfer(holder.address, TIER3);
      const amount = ethers.parseUnits('1000', 18);

      const beforeWhale = await t.balanceOf(treasury.address);
      await t.connect(pair).transfer(holder.address, amount);
      const whaleTax = (await t.balanceOf(treasury.address)) - beforeWhale;

      const beforeMinnow = await t.balanceOf(treasury.address);
      await t.connect(pair).transfer(minnow.address, amount);
      const minnowTax = (await t.balanceOf(treasury.address)) - beforeMinnow;

      expect(whaleTax).to.equal((amount * 100n) / 10_000n);
      expect(minnowTax).to.equal((amount * 300n) / 10_000n);
      expect(whaleTax).to.be.lessThan(minnowTax);
    });

    it('taxes a tier-1 sell at 5%', async () => {
      const { t, deployer, holder, pair, treasury } = await taxFixture();

      const amount = ethers.parseUnits('1000', 18);
      await t.connect(deployer).transfer(holder.address, amount); // wallet→wallet, untaxed
      const tax = (amount * 500n) / 10_000n;
      const pairBefore = await t.balanceOf(pair.address);
      const treasuryBefore = await t.balanceOf(treasury.address);

      await t.connect(holder).transfer(pair.address, amount);

      expect(await t.balanceOf(pair.address)).to.equal(pairBefore + amount - tax);
      expect(await t.balanceOf(treasury.address)).to.equal(treasuryBefore + tax);
      expect(await t.balanceOf(holder.address)).to.equal(0n);
    });

    it('taxes a tier-3 sell at only 1.5%', async () => {
      const { t, deployer, holder, pair, treasury } = await taxFixture();

      await t.connect(deployer).transfer(holder.address, TIER3);
      const amount = ethers.parseUnits('1000', 18);
      const tax = (amount * 150n) / 10_000n;
      const treasuryBefore = await t.balanceOf(treasury.address);

      await t.connect(holder).transfer(pair.address, amount);

      expect((await t.balanceOf(treasury.address)) - treasuryBefore).to.equal(tax);
    });

    it('never taxes wallet→wallet transfers or excluded accounts', async () => {
      const { t, deployer, holder, pair, treasury } = await taxFixture();

      const amount = ethers.parseUnits('1000', 18);
      const treasuryBefore = await t.balanceOf(treasury.address);

      await t.connect(deployer).transfer(holder.address, amount); // wallet→wallet
      expect(await t.balanceOf(treasury.address)).to.equal(treasuryBefore);

      await t.connect(deployer).excludeFromFee(holder.address, true);
      await t.connect(pair).transfer(holder.address, amount); // pair→excluded
      expect(await t.balanceOf(treasury.address)).to.equal(treasuryBefore);
      expect(await t.balanceOf(holder.address)).to.equal(amount * 2n);
    });

    it('applies no tax at all while the pair is unset', async () => {
      const [deployer, holder] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('FarmToken');
      const t = (await Factory.deploy(deployer.address)) as any;
      await t.waitForDeployment();

      await t.connect(deployer).transfer(holder.address, ethers.parseUnits('100', 18));

      expect(await t.balanceOf(holder.address)).to.equal(ethers.parseUnits('100', 18));
    });

    it('reverts a taxable swap when the treasury pool is unset', async () => {
      const [deployer, holder, pair] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('FarmToken');
      const t = (await Factory.deploy(deployer.address)) as any;
      await t.waitForDeployment();
      await t.connect(deployer).setPancakePair(pair.address);
      await t.connect(deployer).transfer(pair.address, ethers.parseUnits('1000', 18));

      await expect(t.connect(pair).transfer(holder.address, ethers.parseUnits('100', 18)))
        .to.be.revertedWith('FarmToken: treasury not set');
    });

    it('freezes every transfer while paused (kill switch)', async () => {
      const { t, deployer, holder } = await taxFixture();

      await expect(t.connect(deployer).pause())
        .to.emit(t, 'EmergencyPause')
        .withArgs(deployer.address);

      await expect(t.connect(deployer).transfer(holder.address, 1n))
        .to.be.revertedWithCustomError(t, 'EnforcedPause');

      await t.connect(deployer).unpause();
      await t.connect(deployer).transfer(holder.address, 1n);
      expect(await t.balanceOf(holder.address)).to.equal(1n);
    });

    it('restricts every parameter setter to the owner', async () => {
      const { t, holder } = await taxFixture();

      const attempts = [
        () => t.connect(holder).pause(),
        () => t.connect(holder).unpause(),
        () => t.connect(holder).setPancakePair(holder.address),
        () => t.connect(holder).setTreasuryBuybackPool(holder.address),
        () => t.connect(holder).excludeFromFee(holder.address, true),
        () => t.connect(holder).setTierThresholds(1n, 2n),
        () => t.connect(holder).setTaxRates(1, 1, 1, 1, 1, 1),
      ];

      for (const attempt of attempts) {
        await expect(attempt()).to.be.revertedWithCustomError(t, 'OwnableUnauthorizedAccount');
      }
    });

    it('caps every tax rate at 5% and requires tier2 < tier3', async () => {
      const { t, deployer } = await taxFixture();

      await t.connect(deployer).setTaxRates(500, 500, 500, 500, 500, 500); // exactly at cap

      await expect(t.connect(deployer).setTaxRates(501, 0, 0, 0, 0, 0))
        .to.be.revertedWith('FarmToken: tax exceeds 5%');
      await expect(t.connect(deployer).setTaxRates(0, 0, 0, 0, 0, 501))
        .to.be.revertedWith('FarmToken: tax exceeds 5%');

      await expect(t.connect(deployer).setTierThresholds(TIER3, TIER2))
        .to.be.revertedWith('FarmToken: tier2 must be < tier3');
      await expect(t.connect(deployer).setTierThresholds(TIER2, TIER2))
        .to.be.revertedWith('FarmToken: tier2 must be < tier3');
    });
  });
});
