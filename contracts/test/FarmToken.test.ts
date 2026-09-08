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
});
