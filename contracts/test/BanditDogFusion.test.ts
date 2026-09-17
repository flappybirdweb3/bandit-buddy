import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const parse = (n: number | string) => ethers.parseUnits(String(n), 18);

const SOUL_SHARD_ID = 9999n;
const PULL_COST = parse(50);
const TOKENIZE_COST = parse(15);
const TOKENIZE_COST_3X = parse(40);

/** Mirrors BanditDogFusion.tokenizeDog(): keccak256(abi.encodePacked(player, count, nonce)). */
async function signTokenize(
  signer: SignerWithAddress,
  player: string,
  count: bigint,
  nonce: bigint,
): Promise<string> {
  const hash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256'],
    [player, count, nonce],
  );
  return signer.signMessage(ethers.getBytes(hash));
}

/** Mirrors BanditDogFusion.redeemShards(): keccak256(abi.encodePacked("redeem", player, count, nonce)). */
async function signRedeem(
  signer: SignerWithAddress,
  player: string,
  count: bigint,
  nonce: bigint,
): Promise<string> {
  const hash = ethers.solidityPackedKeccak256(
    ['string', 'address', 'uint256', 'uint256'],
    ['redeem', player, count, nonce],
  );
  return signer.signMessage(ethers.getBytes(hash));
}

describe('BanditDogFusion — gacha commit/reveal, Web2.5 bridge, soul shards', () => {
  async function deployFixture() {
    const [owner, backendSigner, alice, bob, treasury] = await ethers.getSigners();

    const farm = await (await ethers.getContractFactory('FarmToken')).deploy(owner.address);
    const nft = await (await ethers.getContractFactory('GuardDogNFT')).deploy(
      await farm.getAddress(),
      owner.address,
      treasury.address,
      'https://cdn.example/dogs/',
    );
    const fusion = await (await ethers.getContractFactory('BanditDogFusion')).deploy(
      await farm.getAddress(),
      await nft.getAddress(),
      owner.address,
      backendSigner.address,
    );

    const fusionAddress = await fusion.getAddress();
    await nft.connect(owner).setFusionContract(fusionAddress);
    await fusion.connect(owner).setTreasuryAddress(treasury.address);

    await farm.connect(owner).transfer(alice.address, parse(1_000));
    await farm.connect(alice).approve(fusionAddress, ethers.MaxUint256);
    await nft.connect(alice).setApprovalForAll(fusionAddress, true);

    return { farm, nft, fusion, fusionAddress, owner, backendSigner, alice, bob, treasury };
  }

  describe('configuration', () => {
    it('exposes the documented defaults', async () => {
      const { fusion, backendSigner } = await loadFixture(deployFixture);

      expect(await fusion.pullCost()).to.equal(PULL_COST);
      expect(await fusion.tokenizeCost()).to.equal(TOKENIZE_COST);
      expect(await fusion.tokenizeCost3x()).to.equal(TOKENIZE_COST_3X);
      expect(await fusion.backendSigner()).to.equal(backendSigner.address);
      expect(await fusion.MIN_REVEAL_BLOCKS()).to.equal(2n);
      expect(await fusion.REVEAL_WINDOW()).to.equal(256n);
      expect(await fusion.SHARDS_PER_REDEEM()).to.equal(100n);
      expect(await fusion.SOUL_SHARD_ID()).to.equal(SOUL_SHARD_ID);
    });

    it('rejects a zero backend signer at construction', async () => {
      const { farm, nft, fusion, owner } = await loadFixture(deployFixture);
      const Fusion = await ethers.getContractFactory('BanditDogFusion');

      await expect(
        Fusion.deploy(await farm.getAddress(), await nft.getAddress(), owner.address, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(fusion, 'ZeroSigner');
    });
  });

  describe('commit / reveal gacha', () => {
    it('burns the pull cost on commit and blocks a second pending commit', async () => {
      const { farm, fusion, alice } = await loadFixture(deployFixture);

      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);
      const supplyBefore = await farm.totalSupply();

      await expect(fusion.connect(alice).commit(commitment))
        .to.emit(fusion, 'Committed')
        .withArgs(alice.address, commitment, anyValue);

      expect(await farm.totalSupply()).to.equal(supplyBefore - PULL_COST);

      await expect(fusion.connect(alice).commit(commitment))
        .to.be.revertedWithCustomError(fusion, 'AlreadyPending');
    });

    it('allows a new commit if the previous commit expired past REVEAL_WINDOW', async () => {
      const { farm, fusion, alice } = await loadFixture(deployFixture);
      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(alice).commit(commitment);

      // Mine 257 blocks so elapsed > REVEAL_WINDOW (256)
      for (let i = 0; i < 257; i++) {
        await network.provider.send('evm_mine');
      }

      // Old commit cannot be revealed
      await expect(fusion.connect(alice).reveal(secret))
        .to.be.revertedWithCustomError(fusion, 'CommitExpired');

      // But alice can commit anew and is not bricked!
      const newSecret = ethers.randomBytes(32);
      const newCommitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [newSecret, alice.address]);
      await expect(fusion.connect(alice).commit(newCommitment))
        .to.emit(fusion, 'Committed')
        .withArgs(alice.address, newCommitment, anyValue);
    });

    it('rejects reveal before MIN_REVEAL_BLOCKS', async () => {
      const { fusion, alice } = await loadFixture(deployFixture);
      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(alice).commit(commitment);       // block N
      await expect(fusion.connect(alice).reveal(secret))    // block N+1 → elapsed 1
        .to.be.revertedWithCustomError(fusion, 'TooEarly');
    });

    it('rejects a wrong secret once the delay has elapsed', async () => {
      const { fusion, alice } = await loadFixture(deployFixture);
      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(alice).commit(commitment);       // N
      await network.provider.send('evm_mine');              // N+1
      await expect(fusion.connect(alice).reveal(ethers.randomBytes(32))) // N+2
        .to.be.revertedWithCustomError(fusion, 'WrongSecret');
    });

    it('mints exactly one dog on a valid reveal', async () => {
      const { nft, fusion, alice } = await loadFixture(deployFixture);
      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(alice).commit(commitment);       // N
      await network.provider.send('evm_mine');              // N+1
      await expect(fusion.connect(alice).reveal(secret))    // N+2
        .to.emit(fusion, 'Revealed');

      let dogs = 0n;
      for (let id = 1n; id <= 6n; id++) dogs += await nft.balanceOf(alice.address, id);
      expect(dogs).to.equal(1n);
    });

    it('rejects reveal without a pending commit', async () => {
      const { fusion, alice } = await loadFixture(deployFixture);
      await expect(fusion.connect(alice).reveal(ethers.randomBytes(32)))
        .to.be.revertedWithCustomError(fusion, 'NoPendingCommit');
    });

    it('rejects reveal after the 256-block window', async () => {
      const { fusion, alice } = await loadFixture(deployFixture);
      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(alice).commit(commitment);
      await network.provider.send('hardhat_mine', ['0x101']); // advance 257 blocks

      await expect(fusion.connect(alice).reveal(secret))
        .to.be.revertedWithCustomError(fusion, 'CommitExpired');
    });
  });

  describe('tokenizeDog — Web2.5 shop-dog bridge', () => {
    it('burns the single-dog cost, charges 0.002 BNB fee to treasury, and mints one Chihuahua', async () => {
      const { farm, nft, fusion, backendSigner, alice, treasury } = await loadFixture(deployFixture);

      const nonce = 1n;
      const sig = await signTokenize(backendSigner, alice.address, 1n, nonce);
      const supplyBefore = await farm.totalSupply();
      const treasuryBnbBefore = await ethers.provider.getBalance(treasury.address);

      await expect(fusion.connect(alice).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.002') }))
        .to.emit(fusion, 'DogTokenized')
        .withArgs(alice.address, 1n, nonce);

      expect(await nft.balanceOf(alice.address, 1n)).to.equal(1n);
      expect(await farm.totalSupply()).to.equal(supplyBefore - TOKENIZE_COST);
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(
        treasuryBnbBefore + ethers.parseEther('0.002')
      );
    });

    it('charges the bulk 3x price and 0.005 BNB bulk fee and mints three dogs', async () => {
      const { farm, nft, fusion, backendSigner, alice, treasury } = await loadFixture(deployFixture);

      const nonce = 2n;
      const sig = await signTokenize(backendSigner, alice.address, 3n, nonce);
      const supplyBefore = await farm.totalSupply();
      const treasuryBnbBefore = await ethers.provider.getBalance(treasury.address);

      await fusion.connect(alice).tokenizeDog(3n, nonce, sig, { value: ethers.parseEther('0.005') });

      expect(await nft.balanceOf(alice.address, 1n)).to.equal(3n);
      expect(await farm.totalSupply()).to.equal(supplyBefore - TOKENIZE_COST_3X);
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(
        treasuryBnbBefore + ethers.parseEther('0.005')
      );
    });

    it('rejects counts other than 1 or 3', async () => {
      const { fusion, backendSigner, alice } = await loadFixture(deployFixture);

      const sig = await signTokenize(backendSigner, alice.address, 2n, 3n);
      await expect(fusion.connect(alice).tokenizeDog(2n, 3n, sig, { value: ethers.parseEther('0.004') }))
        .to.be.revertedWithCustomError(fusion, 'InvalidCount');
    });

    it('reverts when sending insufficient BNB fee', async () => {
      const { fusion, backendSigner, alice } = await loadFixture(deployFixture);

      const nonce = 3n;
      const sig = await signTokenize(backendSigner, alice.address, 1n, nonce);
      await expect(fusion.connect(alice).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.001') }))
        .to.be.revertedWithCustomError(fusion, 'InsufficientBnbFee');
    });

    it('rejects a replayed nonce', async () => {
      const { fusion, backendSigner, alice } = await loadFixture(deployFixture);

      const nonce = 4n;
      const sig = await signTokenize(backendSigner, alice.address, 1n, nonce);

      await fusion.connect(alice).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.002') });
      await expect(fusion.connect(alice).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.002') }))
        .to.be.revertedWithCustomError(fusion, 'NonceUsed');
    });

    it('rejects a signature from anyone but the backend signer', async () => {
      const { fusion, alice, bob } = await loadFixture(deployFixture);

      const nonce = 5n;
      const sig = await signTokenize(bob, alice.address, 1n, nonce);
      await expect(fusion.connect(alice).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.002') }))
        .to.be.revertedWithCustomError(fusion, 'InvalidSignature');
    });

    it('binds the signature to the caller', async () => {
      const { fusion, backendSigner, alice, bob } = await loadFixture(deployFixture);

      const nonce = 6n;
      const sig = await signTokenize(backendSigner, alice.address, 1n, nonce);
      await expect(fusion.connect(bob).tokenizeDog(1n, nonce, sig, { value: ethers.parseEther('0.002') }))
        .to.be.revertedWithCustomError(fusion, 'InvalidSignature');
    });
  });

  describe('redeemShards — 100 shards for a guaranteed tier 3-5 dog', () => {
    it('burns 100 shards and mints exactly one tier 3-5 dog', async () => {
      const { nft, fusion, backendSigner, owner, alice } = await loadFixture(deployFixture);

      await nft.connect(owner).mintTo(alice.address, SOUL_SHARD_ID, 100);

      const nonce = 11n;
      const sig = await signRedeem(backendSigner, alice.address, 1n, nonce);

      await expect(fusion.connect(alice).redeemShards(1n, nonce, sig))
        .to.emit(fusion, 'ShardsRedeemed');

      expect(await nft.balanceOf(alice.address, SOUL_SHARD_ID)).to.equal(0n);

      let dogs = 0n;
      for (const id of [3n, 4n, 5n]) dogs += await nft.balanceOf(alice.address, id);
      expect(dogs).to.equal(1n);
    });

    it('rejects count 0 and counts above MAX_REDEEM_PER_TX', async () => {
      const { fusion, backendSigner, alice } = await loadFixture(deployFixture);

      const zeroSig = await signRedeem(backendSigner, alice.address, 0n, 12n);
      await expect(fusion.connect(alice).redeemShards(0n, 12n, zeroSig))
        .to.be.revertedWithCustomError(fusion, 'InvalidCount');

      const bigSig = await signRedeem(backendSigner, alice.address, 11n, 13n);
      await expect(fusion.connect(alice).redeemShards(11n, 13n, bigSig))
        .to.be.revertedWithCustomError(fusion, 'InvalidCount');
    });

    it('reverts when the player does not hold enough shards', async () => {
      const { nft, fusion, backendSigner, owner, alice } = await loadFixture(deployFixture);

      await nft.connect(owner).mintTo(alice.address, SOUL_SHARD_ID, 99);

      const nonce = 14n;
      const sig = await signRedeem(backendSigner, alice.address, 1n, nonce);
      await expect(fusion.connect(alice).redeemShards(1n, nonce, sig)).to.be.reverted;
    });

    it('rejects a replayed redemption nonce', async () => {
      const { nft, fusion, backendSigner, owner, alice } = await loadFixture(deployFixture);

      await nft.connect(owner).mintTo(alice.address, SOUL_SHARD_ID, 200);

      const nonce = 15n;
      const sig = await signRedeem(backendSigner, alice.address, 1n, nonce);

      await fusion.connect(alice).redeemShards(1n, nonce, sig);
      await expect(fusion.connect(alice).redeemShards(1n, nonce, sig))
        .to.be.revertedWithCustomError(fusion, 'NonceUsed');
    });
  });

  describe('Soul Forge — Dog Fusion & Boosters', () => {
    it('requests fusion, burns base FARM fee, locks 3 base dogs, and emits FusionRequested', async () => {
      const { farm, nft, fusion, alice } = await loadFixture(deployFixture);

      // Mint 3 Tier 1 (Chihuahua) to Alice
      await nft.mintTo(alice.address, 1n, 3n);
      expect(await nft.balanceOf(alice.address, 1n)).to.equal(3n);

      const farmBefore = await farm.balanceOf(alice.address);
      const feeT1 = await fusion.getFusionFee(1n); // 20 FARM

      const tx = await fusion.connect(alice).requestFusion(1n, false, false);
      await expect(tx)
        .to.emit(fusion, 'FusionRequested')
        .withArgs(1n, alice.address, 1n, false, false, false, feeT1);

      // 3 Dogs transferred to fusion contract
      expect(await nft.balanceOf(alice.address, 1n)).to.equal(0n);
      expect(await nft.balanceOf(await fusion.getAddress(), 1n)).to.equal(3n);

      // FARM burned
      expect(await farm.balanceOf(alice.address)).to.equal(farmBefore - feeT1);

      const req = await fusion.getFusionRequest(1n);
      expect(req.player).to.equal(alice.address);
      expect(req.baseTierId).to.equal(1n);
      expect(req.useLuckyBone).to.be.false;
      expect(req.useCollar).to.be.false;
      expect(req.resolved).to.be.false;
    });

    it('charges booster fees when useLuckyBone and useCollar are enabled', async () => {
      const { farm, nft, fusion, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 2n, 3n);
      const farmBefore = await farm.balanceOf(alice.address);

      // T2 fee = 80 + 50 (Lucky Bone) + 150 (Collar) = 280 FARM
      const expectedFee = parse(80 + 50 + 150);

      await expect(fusion.connect(alice).requestFusion(2n, true, true))
        .to.emit(fusion, 'FusionRequested')
        .withArgs(1n, alice.address, 2n, true, true, false, expectedFee);

      expect(await farm.balanceOf(alice.address)).to.equal(farmBefore - expectedFee);
    });

    it('resolves fusion with SUCCESS: burns 3 base dogs and mints Tier N+1 dog', async () => {
      const { nft, fusion, backendSigner, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 1n, 3n);
      await fusion.connect(alice).requestFusion(1n, false, false);

      const fusionAddr = await fusion.getAddress();
      const deadAddr = await fusion.DEAD_ADDRESS();

      // Oracle resolves with success
      await expect(fusion.connect(backendSigner).resolveFusion(1n, true, 0n))
        .to.emit(fusion, 'FusionResolved')
        .withArgs(1n, alice.address, true, 2n, 0n);

      // 3 T1 dogs transferred to dead address (burned)
      expect(await nft.balanceOf(fusionAddr, 1n)).to.equal(0n);
      expect(await nft.balanceOf(deadAddr, 1n)).to.equal(3n);

      // Alice receives 1 Tier 2 (Corgi) dog
      expect(await nft.balanceOf(alice.address, 2n)).to.equal(1n);
    });

    it('resolves fusion with FAIL (no collar): returns 1 dog, burns 2 dogs, mints pity Soul Shards', async () => {
      const { nft, fusion, backendSigner, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 1n, 3n);
      await fusion.connect(alice).requestFusion(1n, false, false);

      const deadAddr = await fusion.DEAD_ADDRESS();

      // Oracle resolves fail with 1 consolation shard
      await expect(fusion.connect(backendSigner).resolveFusion(1n, false, 1n))
        .to.emit(fusion, 'FusionResolved')
        .withArgs(1n, alice.address, false, 0n, 1n)
        .and.to.emit(fusion, 'SoulShardMinted')
        .withArgs(alice.address, 1n);

      // 1 dog returned to Alice, 2 sent to deadAddr
      expect(await nft.balanceOf(alice.address, 1n)).to.equal(1n);
      expect(await nft.balanceOf(deadAddr, 1n)).to.equal(2n);

      // Alice receives 1 Soul Shard
      expect(await nft.balanceOf(alice.address, SOUL_SHARD_ID)).to.equal(1n);
    });

    it('resolves fusion with FAIL (with collar): returns all 3 dogs to player + mints pity Soul Shards', async () => {
      const { nft, fusion, backendSigner, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 2n, 3n);
      await fusion.connect(alice).requestFusion(2n, false, true); // useCollar = true

      const deadAddr = await fusion.DEAD_ADDRESS();

      // Oracle resolves fail with 3 consolation shards
      await expect(fusion.connect(backendSigner).resolveFusion(1n, false, 3n))
        .to.emit(fusion, 'FusionResolved')
        .withArgs(1n, alice.address, false, 0n, 3n);

      // All 3 dogs returned to Alice! 0 dogs sent to deadAddr
      expect(await nft.balanceOf(alice.address, 2n)).to.equal(3n);
      expect(await nft.balanceOf(deadAddr, 2n)).to.equal(0n);

      // Consolation shards received
      expect(await nft.balanceOf(alice.address, SOUL_SHARD_ID)).to.equal(3n);
    });

    it('rejects unauthorized resolution calls', async () => {
      const { nft, fusion, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 1n, 3n);
      await fusion.connect(alice).requestFusion(1n, false, false);

      await expect(fusion.connect(alice).resolveFusion(1n, true, 0n))
        .to.be.revertedWithCustomError(fusion, 'Unauthorized');
    });

    it('rejects double resolution of the same request', async () => {
      const { nft, fusion, backendSigner, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, 1n, 3n);
      await fusion.connect(alice).requestFusion(1n, false, false);

      await fusion.connect(backendSigner).resolveFusion(1n, true, 0n);
      await expect(fusion.connect(backendSigner).resolveFusion(1n, true, 0n))
        .to.be.revertedWithCustomError(fusion, 'RequestAlreadyResolved');
    });

    it('allows direct redeemShards() burning 100 shards without signature', async () => {
      const { nft, fusion, alice } = await loadFixture(deployFixture);

      await nft.mintTo(alice.address, SOUL_SHARD_ID, 100n);
      expect(await nft.balanceOf(alice.address, SOUL_SHARD_ID)).to.equal(100n);

      await expect(fusion.connect(alice)['redeemShards()']())
        .to.emit(fusion, 'ShardsRedeemed');

      expect(await nft.balanceOf(alice.address, SOUL_SHARD_ID)).to.equal(0n);
      // Alice received 1 dog of Tier 3, 4, or 5
      const t3 = await nft.balanceOf(alice.address, 3n);
      const t4 = await nft.balanceOf(alice.address, 4n);
      const t5 = await nft.balanceOf(alice.address, 5n);
      expect(t3 + t4 + t5).to.equal(1n);
    });
  });

  describe('admin', () => {
    it('restricts privileged setters to the owner', async () => {
      const { fusion, alice } = await loadFixture(deployFixture);

      const attempts = [
        () => fusion.connect(alice).setPullCost(1n),
        () => fusion.connect(alice).setTokenizeCost(1n, 1n),
        () => fusion.connect(alice).setBackendSigner(alice.address),
        () => fusion.connect(alice).setNftContract(alice.address),
        () => fusion.connect(alice).pause(),
        () => fusion.connect(alice).unpause(),
      ];

      for (const attempt of attempts) {
        await expect(attempt()).to.be.revertedWithCustomError(fusion, 'OwnableUnauthorizedAccount');
      }
    });

    it('rejects a zero backend signer on rotation', async () => {
      const { fusion, owner } = await loadFixture(deployFixture);
      await expect(fusion.connect(owner).setBackendSigner(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(fusion, 'ZeroSigner');
    });

    it('freezes commit, tokenize and redeem while paused', async () => {
      const { fusion, owner, backendSigner, alice } = await loadFixture(deployFixture);

      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address'], [secret, alice.address]);

      await fusion.connect(owner).pause();

      await expect(fusion.connect(alice).commit(commitment))
        .to.be.revertedWithCustomError(fusion, 'EnforcedPause');

      const nonce = 21n;
      const tokenizeSig = await signTokenize(backendSigner, alice.address, 1n, nonce);
      await expect(fusion.connect(alice).tokenizeDog(1n, nonce, tokenizeSig, { value: ethers.parseEther('0.002') }))
        .to.be.revertedWithCustomError(fusion, 'EnforcedPause');

      const nonce2 = 22n;
      const redeemSig = await signRedeem(backendSigner, alice.address, 1n, nonce2);
      await expect(fusion.connect(alice).redeemShards(1n, nonce2, redeemSig))
        .to.be.revertedWithCustomError(fusion, 'EnforcedPause');
    });
  });
});
