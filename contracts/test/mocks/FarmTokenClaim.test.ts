import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const parse = (n: number | string) => ethers.parseUnits(String(n), 18);

describe('FarmTokenClaim — off-chain GOLD to on-chain FARM gate', () => {
  async function deployFixture() {
    const [owner, signer, newSigner, alice, bob] = await ethers.getSigners();
    const farm = await (await ethers.getContractFactory('FarmToken')).deploy(owner.address);
    const claim = await (await ethers.getContractFactory('FarmTokenClaim'))
      .deploy(farm, signer.address, owner.address);

    await farm.connect(owner).transfer(await claim.getAddress(), parse(10_000));
    return { farm, claim, owner, signer, newSigner, alice, bob };
  }

  async function sign(claim, signer, user, amount, nonce) {
    const [messageHash] = await claim.hashMessage(user, amount, nonce);
    return signer.signMessage(ethers.getBytes(messageHash));
  }

  it('allows valid claim, stores nonce and emits TokensClaimed event', async () => {
    const { farm, claim, signer, alice } = await loadFixture(deployFixture);
    const amount = parse(100);
    const nonce = 7n;
    const sig = await sign(claim, signer, alice.address, amount, nonce);

    await expect(claim.connect(alice).claimTokens(amount, nonce, sig))
      .to.emit(claim, 'TokensClaimed');

    expect(await farm.balanceOf(alice.address)).to.equal(amount);
    expect(await claim.isNonceUsed(alice.address, nonce)).to.equal(true);
    expect(await claim.totalClaimed()).to.equal(amount);
  });

  it('blocks Replay Attack with the same nonce', async () => {
    const { claim, signer, alice } = await loadFixture(deployFixture);
    const amount = parse(100);
    const nonce = 7n;
    const sig = await sign(claim, signer, alice.address, amount, nonce);

    await claim.connect(alice).claimTokens(amount, nonce, sig);
    await expect(claim.connect(alice).claimTokens(amount, nonce, sig))
      .to.be.revertedWithCustomError(claim, 'NonceAlreadyUsed')
      .withArgs(alice.address, nonce);
  });

  it('immediately invalidates old signature when rotating to new signer', async () => {
    const { claim, owner, signer, newSigner, alice } = await loadFixture(deployFixture);
    const amount = parse(10);
    const nonce = 1n;
    const oldSig = await sign(claim, signer, alice.address, amount, nonce);

    await expect(claim.connect(owner).setSigner(newSigner.address))
      .to.emit(claim, 'SignerUpdated').withArgs(signer.address, newSigner.address);

    await expect(claim.connect(alice).claimTokens(amount, nonce, oldSig))
      .to.be.revertedWithCustomError(claim, 'InvalidSignature');

    const newSig = await sign(claim, newSigner, alice.address, amount, nonce);
    await claim.connect(alice).claimTokens(amount, nonce, newSig);
    expect(await claim.isNonceUsed(alice.address, nonce)).to.equal(true);
  });
});