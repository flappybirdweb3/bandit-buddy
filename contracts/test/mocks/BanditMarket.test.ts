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
    await nft.connect(owner).mintTo(seller.address, 1, 1);
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
    expect(await nft.balanceOf(seller.address, 1)).to.equal(0n);
    expect(await farm.balanceOf(seller.address)).to.equal(sellerBefore + price - fee);
    expect(await farm.balanceOf(treasury.address)).to.equal(treasuryBefore + fee);
    expect(await market.usedNonces(seller.address, 1n)).to.equal(true);
  });
});