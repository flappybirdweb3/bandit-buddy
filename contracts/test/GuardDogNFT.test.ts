import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { FarmToken, GuardDogNFT } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('GuardDogNFT', () => {
  let token: FarmToken;
  let nft: GuardDogNFT;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const BASE_URI = 'https://api.barnbuddy.io/nft/metadata/';

  // Prices from constructor (in FARM wei)
  const CHIHUAHUA_PRICE = ethers.parseUnits('50', 18);
  const CORGI_PRICE     = ethers.parseUnits('100', 18);
  const PITBULL_PRICE   = ethers.parseUnits('2000', 18);

  beforeEach(async () => {
    [owner, treasury, alice, bob] = await ethers.getSigners();

    // Deploy FarmToken
    const TokenF = await ethers.getContractFactory('FarmToken');
    token = (await TokenF.deploy(owner.address)) as unknown as FarmToken;
    await token.waitForDeployment();

    // Deploy GuardDogNFT
    const NftF = await ethers.getContractFactory('GuardDogNFT');
    nft = (await NftF.deploy(
      await token.getAddress(),
      owner.address,
      treasury.address,
      BASE_URI,
    )) as unknown as GuardDogNFT;
    await nft.waitForDeployment();

    // Give alice/bob enough FARM to buy dogs (Pitbull costs 2000 * 100 = 200,000)
    await token.transfer(alice.address, ethers.parseUnits('500000', 18));
    await token.connect(alice).approve(await nft.getAddress(), ethers.MaxUint256);

    await token.transfer(bob.address, ethers.parseUnits('500000', 18));
    await token.connect(bob).approve(await nft.getAddress(), ethers.MaxUint256);
  });

  // ─── Deployment ────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('has 6 breeds', async () => {
      expect(await nft.NUM_BREEDS()).to.equal(6n);
    });

    it('breed 1 (Chihuahua) has correct stats', async () => {
      const breed = await nft.getBreed(1);
      expect(breed.name).to.equal('Chihuahua');
      expect(breed.defensePower).to.equal(10n);
      expect(breed.priceInFarm).to.equal(CHIHUAHUA_PRICE);
      expect(breed.maxSupply).to.equal(10_000n);
    });

    it('breed 6 (Pitbull) has correct stats', async () => {
      const breed = await nft.getBreed(6);
      expect(breed.name).to.equal('Pitbull');
      expect(breed.defensePower).to.equal(80n);
      expect(breed.priceInFarm).to.equal(PITBULL_PRICE);
      expect(breed.maxSupply).to.equal(100n);
    });

    it('defaults burnOnPurchase to true', async () => {
      expect(await nft.burnOnPurchase()).to.be.true;
    });

    it('reverts on zero address in constructor', async () => {
      const NftF = await ethers.getContractFactory('GuardDogNFT');
      await expect(
        NftF.deploy(ethers.ZeroAddress, owner.address, treasury.address, 'https://cdn.example/dogs/'),
      ).to.be.revertedWithCustomError(NftF, 'ZeroAddress');
      await expect(
        NftF.deploy(await token.getAddress(), ethers.ZeroAddress, treasury.address, 'https://cdn.example/dogs/'),
      ).to.be.revertedWithCustomError(NftF, 'OwnableInvalidOwner');
      await expect(
        NftF.deploy(await token.getAddress(), owner.address, ethers.ZeroAddress, 'https://cdn.example/dogs/'),
      ).to.be.revertedWithCustomError(NftF, 'ZeroAddress');
    });
  });

  // ─── Purchase ──────────────────────────────────────────────────────────

  describe('buyDog', () => {
    it('mints token to buyer', async () => {
      await nft.connect(alice).buyDog(1, 1);
      expect(await nft.balanceOf(alice.address, 1)).to.equal(1n);
    });

    it('emits DogPurchased event', async () => {
      await expect(nft.connect(alice).buyDog(1, 2))
        .to.emit(nft, 'DogPurchased')
        .withArgs(alice.address, 1n, 2n, CHIHUAHUA_PRICE * 2n);
    });

    it('burns FARM on purchase (burnOnPurchase=true)', async () => {
      const supplyBefore = await token.totalSupply();
      await nft.connect(alice).buyDog(1, 1);
      expect(await token.totalSupply()).to.equal(supplyBefore - CHIHUAHUA_PRICE);
    });

    it('sends FARM to treasury when burnOnPurchase=false', async () => {
      await nft.setBurnMode(false);
      const treasuryBefore = await token.balanceOf(treasury.address);
      await nft.connect(alice).buyDog(1, 1);
      expect(await token.balanceOf(treasury.address)).to.equal(
        treasuryBefore + CHIHUAHUA_PRICE,
      );
    });

    it('deducts correct FARM from buyer', async () => {
      const before = await token.balanceOf(alice.address);
      await nft.connect(alice).buyDog(2, 3); // 3 Corgis
      expect(await token.balanceOf(alice.address)).to.equal(
        before - CORGI_PRICE * 3n,
      );
    });

    it('reverts on invalid tokenId = 0', async () => {
      await expect(nft.connect(alice).buyDog(0, 1))
        .to.be.revertedWithCustomError(nft, 'InvalidTokenId');
    });

    it('reverts on invalid tokenId = 7', async () => {
      await expect(nft.connect(alice).buyDog(7, 1))
        .to.be.revertedWithCustomError(nft, 'InvalidTokenId');
    });

    it('reverts on zero amount', async () => {
      await expect(nft.connect(alice).buyDog(1, 0))
        .to.be.revertedWithCustomError(nft, 'ZeroAmount');
    });

    it('reverts when max supply exceeded', async () => {
      // Pitbull maxSupply = 100; mint 100, then try 1 more
      // mint in batches of 10 to be gas-efficient
      for (let i = 0; i < 10; i++) {
        await nft.connect(alice).buyDog(6, 10);
      }
      await expect(nft.connect(alice).buyDog(6, 1))
        .to.be.revertedWithCustomError(nft, 'MaxSupplyReached');
    });

    it('tracks total supply via ERC1155Supply', async () => {
      await nft.connect(alice).buyDog(1, 5);
      await nft.connect(bob).buyDog(1, 3);
      // ERC1155Supply overloads totalSupply – call with explicit tokenId param
      const supply = await nft['totalSupply(uint256)'](1);
      expect(supply).to.equal(8n);
    });

    it('remainingSupply decreases after purchase', async () => {
      const before = await nft.remainingSupply(1);
      await nft.connect(alice).buyDog(1, 4);
      expect(await nft.remainingSupply(1)).to.equal(before - 4n);
    });

    it('reverts when paused', async () => {
      await nft.pause();
      await expect(nft.connect(alice).buyDog(1, 1)).to.be.reverted;
    });
  });

  // ─── totalDefensePower ─────────────────────────────────────────────────

  describe('totalDefensePower', () => {
    it('returns 0 for address with no dogs', async () => {
      expect(await nft.totalDefensePower(alice.address)).to.equal(0n);
    });

    it('returns correct power for single dog', async () => {
      await nft.connect(alice).buyDog(2, 1); // Corgi = 20%
      expect(await nft.totalDefensePower(alice.address)).to.equal(20n);
    });

    it('stacks power from multiple breed types', async () => {
      await nft.connect(alice).buyDog(1, 1); // Chihuahua: 10
      await nft.connect(alice).buyDog(2, 1); // Corgi: 20
      // Total = 30
      expect(await nft.totalDefensePower(alice.address)).to.equal(30n);
    });

    it('stacks power from multiples of same breed', async () => {
      await nft.connect(alice).buyDog(2, 2); // 2x Corgi: 40
      expect(await nft.totalDefensePower(alice.address)).to.equal(40n);
    });

    it('caps total defense power at 80', async () => {
      // Pitbull(80) + Corgi(20) = 100 → capped to 80
      await nft.connect(alice).buyDog(6, 1); // Pitbull: 80
      await nft.connect(alice).buyDog(2, 1); // Corgi: 20
      expect(await nft.totalDefensePower(alice.address)).to.equal(80n);
    });
  });

  // ─── URI ──────────────────────────────────────────────────────────────

  describe('URI', () => {
    it('returns correct URI for tokenId 1', async () => {
      expect(await nft.uri(1)).to.equal(`${BASE_URI}1.json`);
    });

    it('returns correct URI for tokenId 6', async () => {
      expect(await nft.uri(6)).to.equal(`${BASE_URI}6.json`);
    });

    it('owner can update base URI', async () => {
      const newUri = 'https://cdn.barnbuddy.io/dogs/';
      await expect(nft.setBaseURI(newUri))
        .to.emit(nft, 'BaseURIUpdated')
        .withArgs(newUri);
      expect(await nft.uri(1)).to.equal(`${newUri}1.json`);
    });
  });

  // ─── Admin ─────────────────────────────────────────────────────────────

  describe('admin', () => {
    it('owner can update price', async () => {
      const newPrice = ethers.parseUnits('75', 18);
      await expect(nft.setPrice(1, newPrice))
        .to.emit(nft, 'PriceUpdated')
        .withArgs(1n, newPrice);
      const breed = await nft.getBreed(1);
      expect(breed.priceInFarm).to.equal(newPrice);
    });

    it('non-owner cannot update price', async () => {
      await expect(
        nft.connect(alice).setPrice(1, ethers.parseUnits('1', 18)),
      ).to.be.reverted;
    });

    it('owner can set treasury', async () => {
      await expect(nft.setTreasury(bob.address))
        .to.emit(nft, 'TreasuryUpdated')
        .withArgs(bob.address);
      expect(await nft.treasury()).to.equal(bob.address);
    });

    it('setTreasury reverts on zero address', async () => {
      await expect(nft.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(nft, 'ZeroAddress');
    });

    it('owner can mintTo for airdrops', async () => {
      await nft.mintTo(bob.address, 3, 2);
      expect(await nft.balanceOf(bob.address, 3)).to.equal(2n);
    });

    it('mintTo reverts over maxSupply', async () => {
      // Pitbull maxSupply = 100
      await nft.mintTo(alice.address, 6, 100);
      await expect(nft.mintTo(bob.address, 6, 1))
        .to.be.revertedWithCustomError(nft, 'MaxSupplyReached');
    });

    it('owner can toggle burn mode', async () => {
      await expect(nft.setBurnMode(false))
        .to.emit(nft, 'BurnModeUpdated')
        .withArgs(false);
      expect(await nft.burnOnPurchase()).to.be.false;
    });

    it('owner can pause and unpause', async () => {
      await nft.pause();
      expect(await nft.paused()).to.be.true;
      await nft.unpause();
      expect(await nft.paused()).to.be.false;
    });
  });

  // ─── Fusion authorisation (BanditDogFusion is the only authorised minter) ──

  describe('fusion authorisation', () => {
    let fusionAddress: string;
    let fusionSigner: SignerWithAddress;

    beforeEach(async () => {
      const backendSigner = (await ethers.getSigners())[4];
      const Fusion = await ethers.getContractFactory('BanditDogFusion');
      const fusion = await Fusion.deploy(
        await token.getAddress(),
        await nft.getAddress(),
        owner.address,
        backendSigner.address,
      );
      await fusion.waitForDeployment();
      fusionAddress = await fusion.getAddress();
      await nft.connect(owner).setFusionContract(fusionAddress);

      // Impersonate the fusion contract so we can exercise mint()/burnShard()
      // through the real `msg.sender == fusionContract` gate.
      await ethers.provider.send('hardhat_impersonateAccount', [fusionAddress]);
      await ethers.provider.send('hardhat_setBalance', [
        fusionAddress,
        '0x1000000000000000000',
      ]);
      fusionSigner = await ethers.getSigner(fusionAddress);
    });

    it('reverts mint() for any caller that is not the fusion contract', async () => {
      await expect(nft.connect(alice).mint(alice.address, 1, 1, '0x'))
        .to.be.revertedWith('Not fusion contract');
    });

    it('lets the fusion contract mint a capped breed through mint()', async () => {
      await nft.connect(fusionSigner).mint(alice.address, 5, 2, '0x');
      expect(await nft.balanceOf(alice.address, 5)).to.equal(2n);
    });

    it('lets the fusion contract mint unlimited Soul Shards (id 9999)', async () => {
      await nft.connect(fusionSigner).mint(alice.address, 9999, 500, '0x');
      expect(await nft.balanceOf(alice.address, 9999)).to.equal(500n);
    });

    it('still enforces maxSupply for capped breeds minted via the fusion contract', async () => {
      await nft.connect(fusionSigner).mint(alice.address, 6, 100, '0x'); // Pitbull cap = 100
      await expect(nft.connect(fusionSigner).mint(alice.address, 6, 1, '0x'))
        .to.be.revertedWithCustomError(nft, 'MaxSupplyReached');
    });

    it('rejects an out-of-range breed id from the fusion contract', async () => {
      await expect(nft.connect(fusionSigner).mint(alice.address, 7, 1, '0x'))
        .to.be.revertedWithCustomError(nft, 'InvalidTokenId');
    });

    it('restricts burnShard() to the fusion contract', async () => {
      await nft.connect(owner).mintTo(alice.address, 9999, 10);
      await expect(nft.connect(alice).burnShard(alice.address, 1))
        .to.be.revertedWith('Not fusion contract');
    });

    it('restricts setFusionContract() to the owner', async () => {
      await expect(nft.connect(alice).setFusionContract(alice.address)).to.be.reverted;
      await expect(nft.connect(owner).setFusionContract(bob.address))
        .to.emit(nft, 'FusionContractUpdated')
        .withArgs(bob.address);
    });
  });
});
