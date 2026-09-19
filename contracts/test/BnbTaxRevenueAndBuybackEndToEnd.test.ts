import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';

const parseEther = (n: number | string) => ethers.parseEther(String(n));
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

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

async function signTokenize(
  signer: { signMessage: (arg0: Uint8Array) => Promise<string> },
  player: string,
  count: bigint,
  nonce: bigint
) {
  const hash = ethers.solidityPackedKeccak256(['address', 'uint256', 'uint256'], [player, count, nonce]);
  return signer.signMessage(ethers.getBytes(hash));
}

describe('E2E Ecosystem Simulation: BNB Tax Revenue Streams -> Vault -> 2.0 BNB Auto BuyBack & Burn', () => {
  async function deployEcosystemFixture() {
    const [owner, backendSigner, seller, whaleBuyer, player1, player2, keeperBot] = await ethers.getSigners();

    // 1. Deploy FarmToken ($FARM)
    const FarmTokenFactory = await ethers.getContractFactory('FarmToken');
    const farmToken = await FarmTokenFactory.deploy(owner.address);

    // 2. Deploy Mock Router & seed liquidity
    const MockRouterFactory = await ethers.getContractFactory('MockMaliciousRouter');
    const router = await MockRouterFactory.deploy();
    const wbnbAddress = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';

    // Deploy mock USDT for TreasuryBuyBack constructor
    const MockUsdtFactory = await ethers.getContractFactory('FarmToken');
    const mockUsdt = await MockUsdtFactory.deploy(owner.address);

    // 3. Deploy TreasuryBuyBack (threshold = 2.0 BNB)
    const TreasuryFactory = await ethers.getContractFactory('TreasuryBuyBack');
    const treasury = await TreasuryFactory.deploy(
      await farmToken.getAddress(),
      await router.getAddress(),
      wbnbAddress,
      await mockUsdt.getAddress(),
      owner.address
    );
    const treasuryAddress = await treasury.getAddress();

    await router.setFarmToken(await farmToken.getAddress());
    await farmToken.connect(owner).transfer(await router.getAddress(), parseEther(2_000_000));

    // 4. Deploy GuardDogNFT
    const NftFactory = await ethers.getContractFactory('GuardDogNFT');
    const nft = await NftFactory.deploy(
      await farmToken.getAddress(),
      owner.address,
      treasuryAddress,
      'https://cdn.banditbuddy.io/dogs/'
    );
    const nftAddress = await nft.getAddress();

    // 5. Deploy BanditDogFusion (Web2.5 Bridge)
    const FusionFactory = await ethers.getContractFactory('BanditDogFusion');
    const fusion = await FusionFactory.deploy(
      await farmToken.getAddress(),
      nftAddress,
      owner.address,
      backendSigner.address
    );
    const fusionAddress = await fusion.getAddress();
    await nft.connect(owner).setFusionContract(fusionAddress);
    await fusion.connect(owner).setTreasuryAddress(treasuryAddress);

    // 6. Deploy BarnServices (In-App Subscriptions)
    const BarnServicesFactory = await ethers.getContractFactory('BarnServices');
    const barnServices = await BarnServicesFactory.deploy(treasuryAddress, owner.address);

    // 7. Deploy BanditMarket (P2P Trading)
    const MarketFactory = await ethers.getContractFactory('BanditMarket');
    const market = await MarketFactory.deploy(
      await farmToken.getAddress(),
      treasuryAddress,
      owner.address
    );
    const marketAddress = await market.getAddress();

    // Fund players with FARM for tokenization
    await farmToken.connect(owner).transfer(player1.address, parseEther(500));
    await farmToken.connect(owner).transfer(player2.address, parseEther(500));
    await farmToken.connect(player1).approve(fusionAddress, ethers.MaxUint256);
    await farmToken.connect(player2).approve(fusionAddress, ethers.MaxUint256);

    // Setup seller with dog NFT and approval for market
    await nft.connect(owner).mintTo(seller.address, 4, 1); // Tier 4 Rottweiler
    await nft.connect(seller).setApprovalForAll(marketAddress, true);

    const { chainId } = await ethers.provider.getNetwork();
    const marketDomain = {
      name: 'BanditMarket',
      version: '2',
      chainId,
      verifyingContract: marketAddress,
    };

    return {
      farmToken,
      router,
      treasury,
      treasuryAddress,
      nft,
      nftAddress,
      fusion,
      fusionAddress,
      barnServices,
      market,
      marketAddress,
      marketDomain,
      owner,
      backendSigner,
      seller,
      whaleBuyer,
      player1,
      player2,
      keeperBot,
    };
  }

  it('accumulates BNB from all 3 revenue streams to reach 2.0 BNB threshold and triggers buyback & burn', async () => {
    const {
      farmToken,
      router,
      treasury,
      treasuryAddress,
      nft,
      nftAddress,
      fusion,
      barnServices,
      market,
      marketDomain,
      backendSigner,
      seller,
      whaleBuyer,
      player1,
      player2,
      keeperBot,
    } = await loadFixture(deployEcosystemFixture);

    // Check initial treasury state
    expect(await ethers.provider.getBalance(treasuryAddress)).to.equal(0n);
    expect(await treasury.buyBackThreshold()).to.equal(parseEther(2.0));

    // Trying to trigger buyback when balance is 0 reverts
    await expect(treasury.connect(keeperBot).triggerBuyBack())
      .to.be.revertedWithCustomError(treasury, 'ThresholdNotReached');

    console.log('--- STREAM 1: Web2.5 Bridge Tokenize Dogs ---');
    // Player 1 tokenizes 1 dog: 15 FARM + 0.002 BNB
    const sig1 = await signTokenize(backendSigner, player1.address, 1n, 101n);
    await fusion.connect(player1).tokenizeDog(1n, 101n, sig1, { value: parseEther('0.002') });

    // Player 2 tokenizes 3 dogs (bulk): 40 FARM + 0.005 BNB
    const sig2 = await signTokenize(backendSigner, player2.address, 3n, 102n);
    await fusion.connect(player2).tokenizeDog(3n, 102n, sig2, { value: parseEther('0.005') });

    let vaultBalance = await ethers.provider.getBalance(treasuryAddress);
    expect(vaultBalance).to.equal(parseEther('0.007'));
    console.log(`✓ Vault Balance after Stream 1: ${ethers.formatEther(vaultBalance)} BNB`);

    console.log('--- STREAM 2: Premium Subscriptions (BarnServices) ---');
    // Player 1 buys 7-Day Butler Auto-Harvest & Crop Insurance (0.005 BNB)
    await barnServices.connect(player1).purchasePremiumSubscription(1, { value: parseEther('0.005') });

    // Player 2 buys 30-Day Butler Auto-Harvest & Crop Insurance (0.015 BNB)
    await barnServices.connect(player2).purchasePremiumSubscription(2, { value: parseEther('0.015') });

    vaultBalance = await ethers.provider.getBalance(treasuryAddress);
    expect(vaultBalance).to.equal(parseEther('0.027')); // 0.007 + 0.020 = 0.027 BNB
    console.log(`✓ Vault Balance after Stream 2: ${ethers.formatEther(vaultBalance)} BNB`);

    console.log('--- STREAM 3: High-Value NFT Marketplace P2P Trading in BNB ---');
    // Whale buys Tier 4 Rottweiler NFT on marketplace for 66.0 BNB
    // Platform fee: 3% of 66.0 BNB = 1.98 BNB directly to TreasuryBuyBack!
    const priceBNB = parseEther('66.0');
    const order = {
      seller: seller.address,
      nftContract: nftAddress,
      tokenId: 4n,
      amount: 1n,
      priceBNB,
      nonce: 501n,
      deadline: BigInt(await time.latest()) + 3600n,
    };
    const sigMarket = await seller.signTypedData(marketDomain, NFT_ORDER_BNB_TYPES, order);

    await market.connect(whaleBuyer).buyNFTWithBNB(order, sigMarket, { value: priceBNB });

    vaultBalance = await ethers.provider.getBalance(treasuryAddress);
    // 0.027 BNB + 1.98 BNB = 2.007 BNB!
    expect(vaultBalance).to.equal(parseEther('2.007'));
    console.log(`✓ Vault Balance after Stream 3: ${ethers.formatEther(vaultBalance)} BNB (>= 2.0 BNB threshold!)`);

    console.log('--- TRIGGER BUYBACK & BURN ON PANCAKESWAP ---');
    // Set expected FARM output from router
    const expectedBurnedFarm = parseEther('125000');
    await router.setMockFarmOut(expectedBurnedFarm);

    const deadBalBefore = await farmToken.balanceOf(DEAD_ADDRESS);
    expect(deadBalBefore).to.equal(0n);

    // Keeper Bot or Backend trigger detects balance >= 2.0 BNB and executes triggerBuyBack()
    const triggerTx = await treasury.connect(keeperBot).triggerBuyBack();
    await expect(triggerTx)
      .to.emit(treasury, 'BuyBackAndBurned')
      .withArgs(parseEther('2.007'), expectedBurnedFarm);

    // Vault BNB balance is completely spent on buyback
    const finalVaultBalance = await ethers.provider.getBalance(treasuryAddress);
    expect(finalVaultBalance).to.equal(0n);

    // Dead address received the burned FARM tokens
    const deadBalAfter = await farmToken.balanceOf(DEAD_ADDRESS);
    expect(deadBalAfter).to.equal(expectedBurnedFarm);

    // Contract state counters updated
    expect(await treasury.totalBurned()).to.equal(expectedBurnedFarm);
    expect(await treasury.totalBnbSpent()).to.equal(parseEther('2.007'));

    console.log('================================================================');
    console.log('SUCCESS: Full End-to-End Simulation Confirmed!');
    console.log(`- Total BNB Collected & Disbursed: ${ethers.formatEther(parseEther('2.007'))} BNB`);
    console.log(`- Total $FARM Bought & Burned:     ${ethers.formatEther(expectedBurnedFarm)} FARM`);
    console.log(`- Vault Remaining Balance:         0.0000 BNB`);
    console.log('================================================================');
  });
});
