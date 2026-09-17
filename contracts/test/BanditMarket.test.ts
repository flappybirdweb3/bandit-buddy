import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';

const parse = (n: number | string) => ethers.parseUnits(String(n), 18);

const NFT_ORDER_TYPES = {
  NFTOrder: [
    { name: 'seller', type: 'address' },
    { name: 'nftContract', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'priceFarm', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const NFT_ORDER_BNB_TYPES = {
  NFTOrderBNB: [
    { name: 'seller', type: 'address' },
    { name: 'nftContract', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'priceBNB', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

describe('BanditMarket — EIP-712 orders & marketplace safety', () => {
  async function deployFixture() {
    const [owner, seller, buyer, treasury] = await ethers.getSigners();
    const farm = await (await ethers.getContractFactory('FarmToken')).deploy(owner.address);
    const nft = await (await ethers.getContractFactory('GuardDogNFT'))
      .deploy(farm, owner.address, treasury.address, 'https://cdn.example/dogs/');
    const market = await (await ethers.getContractFactory('BanditMarket'))
      .deploy(farm, treasury.address, owner.address);

    const marketAddress = await market.getAddress();
    const nftAddress = await nft.getAddress();

    await farm.connect(owner).transfer(buyer.address, parse(100_000));
    await nft.connect(owner).mintTo(seller.address, 1, 2);
    await nft.connect(seller).setApprovalForAll(marketAddress, true);

    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: 'BanditMarket',
      version: '2',
      chainId,
      verifyingContract: marketAddress,
    };

    return { farm, nft, market, seller, buyer, treasury, domain, nftAddress, marketAddress };
  }

  it('matches on-chain hash with off-chain EIP-712', async () => {
    const { market, seller, nftAddress, domain } = await loadFixture(deployFixture);
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 1n,
      amount: 1n,
      priceFarm: parse(1_000),
      nonce: 1n,
      deadline: BigInt(await time.latest()) + 3600n,
    };

    const onchain = await market.hashNFTOrder(order);
    const offchain = ethers.TypedDataEncoder.hash(domain, NFT_ORDER_TYPES, order);
    expect(onchain).to.equal(offchain);
  });

  it('fills NFT buy order: transfers NFT, deducts 5% treasury fee, burns nonce', async () => {
    const { farm, nft, market, seller, buyer, treasury, nftAddress, domain } = await loadFixture(deployFixture);
    const price = parse(1_000);
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 1n,
      amount: 1n,
      priceFarm: price,
      nonce: 1n,
      deadline: BigInt(await time.latest()) + 3600n,
    };
    const sig = await seller.signTypedData(domain, NFT_ORDER_TYPES, order);

    const fee = (price * 500n) / 10_000n;
    await farm.connect(buyer).approve(await market.getAddress(), price);

    const sellerBefore = await farm.balanceOf(seller.address);
    const treasuryBefore = await farm.balanceOf(treasury.address);

    await expect(market.connect(buyer).buyNFT(order, sig))
      .to.emit(market, 'NFTOrderFilled');

    expect(await nft.balanceOf(buyer.address, 1)).to.equal(1n);
    expect(await nft.balanceOf(seller.address, 1)).to.equal(1n);
    expect(await farm.balanceOf(seller.address)).to.equal(sellerBefore + price - fee);
    expect(await farm.balanceOf(treasury.address)).to.equal(treasuryBefore + fee);
    expect(await market.usedNonces(seller.address, 1n)).to.equal(true);
  });

  it('matches on-chain hash for BNB order', async () => {
    const { market, seller, nftAddress, domain } = await loadFixture(deployFixture);
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 1n,
      amount: 1n,
      priceBNB: ethers.parseEther('1.0'),
      nonce: 2n,
      deadline: BigInt(await time.latest()) + 3600n,
    };

    const onchain = await market.hashNFTOrderBNB(order);
    const offchain = ethers.TypedDataEncoder.hash(domain, NFT_ORDER_BNB_TYPES, order);
    expect(onchain).to.equal(offchain);
  });

  it('fills NFT buy order with BNB: 97% to seller, 3% to treasury, transfers NFT', async () => {
    const { nft, market, seller, buyer, treasury, nftAddress, domain } = await loadFixture(deployFixture);
    const priceBNB = ethers.parseEther('1.0');
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 1n,
      amount: 1n,
      priceBNB,
      nonce: 3n,
      deadline: BigInt(await time.latest()) + 3600n,
    };
    const sig = await seller.signTypedData(domain, NFT_ORDER_BNB_TYPES, order);

    const feeBNB = (priceBNB * 300n) / 10_000n; // 0.03 BNB (3%)
    const sellerReceives = priceBNB - feeBNB;    // 0.97 BNB (97%)

    const sellerBnbBefore = await ethers.provider.getBalance(seller.address);
    const treasuryBnbBefore = await ethers.provider.getBalance(treasury.address);

    await expect(market.connect(buyer).buyNFTWithBNB(order, sig, { value: priceBNB }))
      .to.emit(market, 'NFTOrderFilledBNB')
      .withArgs(buyer.address, seller.address, nftAddress, 1n, 1n, priceBNB, feeBNB);

    expect(await nft.balanceOf(buyer.address, 1)).to.equal(1n);
    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBnbBefore + sellerReceives);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBnbBefore + feeBNB);
    expect(await market.usedNonces(seller.address, 3n)).to.equal(true);
  });

  it('reverts buyNFTWithBNB if msg.value does not match priceBNB', async () => {
    const { market, seller, buyer, nftAddress, domain } = await loadFixture(deployFixture);
    const priceBNB = ethers.parseEther('1.0');
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 1n,
      amount: 1n,
      priceBNB,
      nonce: 4n,
      deadline: BigInt(await time.latest()) + 3600n,
    };
    const sig = await seller.signTypedData(domain, NFT_ORDER_BNB_TYPES, order);

    await expect(
      market.connect(buyer).buyNFTWithBNB(order, sig, { value: ethers.parseEther('0.5') })
    ).to.be.revertedWithCustomError(market, 'IncorrectBNBAmount');
  });
});