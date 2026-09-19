/**
 * AuditDeployConfig.test.ts
 *
 * Deployment Configuration Verification — 13 checklist items:
 *
 * 1.  FarmToken: pancakePair is set (non-zero)
 * 2.  FarmToken: treasuryBuybackPool is set to TreasuryBuyBack address
 * 3.  FarmToken: owner is excluded from fee
 * 4.  FarmToken: FarmToken contract itself is excluded from fee
 * 5.  FarmToken: BanditDogFusion is excluded from fee
 * 6.  FarmToken: WalletGateway is excluded from fee
 * 7.  FarmToken: TreasuryBuyBack is excluded from fee
 * 8.  FarmToken: DEAD address is excluded from fee (prevents tax on burns)
 * 9.  TreasuryBuyBack: buyBackThreshold = 2.0 BNB
 * 10. TreasuryBuyBack: slippageBps = 600 (6%)
 * 11. TreasuryBuyBack: usdtConversionThreshold = 50 USDT
 * 12. BanditDogFusion: treasuryAddress wired to TreasuryBuyBack
 * 13. BarnServices: treasury wired to TreasuryBuyBack
 *     BanditMarket: treasury wired to TreasuryBuyBack
 *     WalletGateway: treasuryVault wired to TreasuryBuyBack
 *     GuardDogNFT: fusionContract wired to BanditDogFusion
 *     BanditDogFusion: backendSigner is non-zero
 *     FarmToken: tier thresholds are consistent (tier2 < tier3)
 */
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const E18 = (n: number | string) => ethers.parseEther(String(n));
const DEAD = '0x000000000000000000000000000000000000dEaD';

// ── Full Production-like Deployment Fixture ──────────────────────────────────

async function deployProductionFixture() {
  const [owner, backendSigner, mockPancakePair] = await ethers.getSigners();

  // 1. Deploy FarmToken
  const FarmFactory = await ethers.getContractFactory('FarmToken');
  const farm = await FarmFactory.deploy(owner.address);

  // 2. Deploy GuardDogNFT
  const NftFactory = await ethers.getContractFactory('GuardDogNFT');
  const nft = await NftFactory.deploy(
    await farm.getAddress(),
    owner.address,
    owner.address,
    'https://cdn.example/dogs/',
  );

  // 3. Deploy MockRouter (stands in for PancakeSwap V2)
  const RouterFactory = await ethers.getContractFactory('MockMaliciousRouter');
  const router = await RouterFactory.deploy();

  // 4. Deploy MockERC20 as USDT
  const MockErc20Factory = await ethers.getContractFactory('MockERC20');
  const usdt = await MockErc20Factory.deploy();

  const wbnb = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';

  // 5. Deploy TreasuryBuyBack
  const TreasuryFactory = await ethers.getContractFactory('TreasuryBuyBack');
  const treasury = await TreasuryFactory.deploy(
    await farm.getAddress(),
    await router.getAddress(),
    wbnb,
    await usdt.getAddress(),
    owner.address,
  );

  // 6. Deploy WalletGateway
  const GatewayFactory = await ethers.getContractFactory('WalletGateway');
  const gateway = await GatewayFactory.deploy(
    await treasury.getAddress() as unknown as string,
    await farm.getAddress(),
    await router.getAddress(),
    await usdt.getAddress(),
    wbnb,
    owner.address,
  );

  // 7. Deploy BanditDogFusion
  const FusionFactory = await ethers.getContractFactory('BanditDogFusion');
  const fusion = await FusionFactory.deploy(
    await farm.getAddress(),
    await nft.getAddress(),
    owner.address,
    backendSigner.address,
  );

  // 8. Deploy BarnServices
  const ServicesFactory = await ethers.getContractFactory('BarnServices');
  const barnServices = await ServicesFactory.deploy(
    await treasury.getAddress(),
    owner.address,
  );

  // 9. Deploy BanditMarket
  const MarketFactory = await ethers.getContractFactory('BanditMarket');
  const market = await MarketFactory.deploy(
    await farm.getAddress(),
    await treasury.getAddress(),
    owner.address,
  );

  // ── Post-deployment configuration (mirrors deployment script) ──

  // Wire FarmToken to PancakePair (simulate post-pool-creation)
  await farm.setPancakePair(mockPancakePair.address);

  // Wire TreasuryBuyBack as FarmToken's treasury
  await farm.setTreasuryBuybackPool(await treasury.getAddress());

  // Exclude critical in-game contracts from FARM DEX tax
  await farm.excludeFromFee(await farm.getAddress(), true);
  await farm.excludeFromFee(await fusion.getAddress(), true);
  await farm.excludeFromFee(await gateway.getAddress(), true);
  await farm.excludeFromFee(await treasury.getAddress(), true);
  await farm.excludeFromFee(await nft.getAddress(), true);
  await farm.excludeFromFee(DEAD, true);
  await farm.excludeFromFee(owner.address, true);

  // Wire BanditDogFusion → TreasuryBuyBack
  await fusion.setTreasuryAddress(await treasury.getAddress());

  // Wire GuardDogNFT → BanditDogFusion
  await nft.setFusionContract(await fusion.getAddress());

  return {
    owner, backendSigner, mockPancakePair,
    farm, nft, router, usdt, treasury, gateway, fusion, barnServices, market, wbnb,
  };
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Deployment Configuration Audit — 13 Checklist Items', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Item 1 — FarmToken: pancakePair is set (non-zero)
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-01] FarmToken.pancakePair is set to a non-zero address', async () => {
    const { farm, mockPancakePair } = await loadFixture(deployProductionFixture);
    const pair = await farm.pancakePair();
    expect(pair).to.not.equal(ethers.ZeroAddress, 'pancakePair must be set for DEX tax to work');
    expect(pair).to.equal(mockPancakePair.address);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 2 — FarmToken: treasuryBuybackPool wired to TreasuryBuyBack
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-02] FarmToken.treasuryBuybackPool is TreasuryBuyBack address', async () => {
    const { farm, treasury } = await loadFixture(deployProductionFixture);
    expect(await farm.treasuryBuybackPool()).to.equal(
      await treasury.getAddress(),
      'DEX tax must accumulate in TreasuryBuyBack',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 3 — FarmToken: owner is excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-03] FarmToken.isExcludedFromFee[owner] = true', async () => {
    const { farm, owner } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(owner.address)).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 4 — FarmToken: contract itself excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-04] FarmToken.isExcludedFromFee[farmToken itself] = true', async () => {
    const { farm } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(await farm.getAddress())).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 5 — FarmToken: BanditDogFusion excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-05] FarmToken.isExcludedFromFee[BanditDogFusion] = true', async () => {
    const { farm, fusion } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(await fusion.getAddress())).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 6 — FarmToken: WalletGateway excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-06] FarmToken.isExcludedFromFee[WalletGateway] = true', async () => {
    const { farm, gateway } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(await gateway.getAddress())).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 7 — FarmToken: TreasuryBuyBack excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-07] FarmToken.isExcludedFromFee[TreasuryBuyBack] = true', async () => {
    const { farm, treasury } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(await treasury.getAddress())).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 8 — FarmToken: DEAD address excluded from fee
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-08] FarmToken.isExcludedFromFee[DEAD_ADDRESS] = true (prevents tax-on-burn)', async () => {
    const { farm } = await loadFixture(deployProductionFixture);
    expect(await farm.isExcludedFromFee(DEAD)).to.be.true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 9 — TreasuryBuyBack: buyBackThreshold = 2.0 BNB
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-09] TreasuryBuyBack.buyBackThreshold = 2.0 BNB', async () => {
    const { treasury } = await loadFixture(deployProductionFixture);
    expect(await treasury.buyBackThreshold()).to.equal(E18('2.0'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 10 — TreasuryBuyBack: slippageBps = 600 (6%)
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-10] TreasuryBuyBack.slippageBps = 600 (6% slippage floor for buyback)', async () => {
    const { treasury } = await loadFixture(deployProductionFixture);
    expect(await treasury.slippageBps()).to.equal(600n);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 11 — TreasuryBuyBack: usdtConversionThreshold = 50 USDT
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-11] TreasuryBuyBack.usdtConversionThreshold = 50 USDT', async () => {
    const { treasury } = await loadFixture(deployProductionFixture);
    expect(await treasury.usdtConversionThreshold()).to.equal(E18('50'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 12 — BanditDogFusion: treasuryAddress wired to TreasuryBuyBack
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-12] BanditDogFusion.treasuryAddress = TreasuryBuyBack address', async () => {
    const { fusion, treasury } = await loadFixture(deployProductionFixture);
    expect(await fusion.treasuryAddress()).to.equal(
      await treasury.getAddress(),
      'BNB revenue from fusion must route to TreasuryBuyBack',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13a — BarnServices: treasury wired to TreasuryBuyBack
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13a] BarnServices.treasury = TreasuryBuyBack address', async () => {
    const { barnServices, treasury } = await loadFixture(deployProductionFixture);
    expect(await barnServices.treasury()).to.equal(
      await treasury.getAddress(),
      'BarnServices subscription revenue must route to TreasuryBuyBack',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13b — BanditMarket: treasury wired to TreasuryBuyBack
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13b] BanditMarket.treasury = TreasuryBuyBack address', async () => {
    const { market, treasury } = await loadFixture(deployProductionFixture);
    expect(await market.treasury()).to.equal(
      await treasury.getAddress(),
      'NFT marketplace fees must route to TreasuryBuyBack',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13c — WalletGateway: treasuryVault wired to TreasuryBuyBack
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13c] WalletGateway.treasuryVault = TreasuryBuyBack address', async () => {
    const { gateway, treasury } = await loadFixture(deployProductionFixture);
    expect(await gateway.treasuryVault()).to.equal(
      await treasury.getAddress(),
      'P2P BNB transfer fees and cashout fees must route to TreasuryBuyBack',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13d — GuardDogNFT: fusionContract wired to BanditDogFusion
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13d] GuardDogNFT.fusionContract = BanditDogFusion address', async () => {
    const { nft, fusion } = await loadFixture(deployProductionFixture);
    expect(await nft.fusionContract()).to.equal(
      await fusion.getAddress(),
      'GuardDogNFT must accept mints only from BanditDogFusion',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13e — BanditDogFusion: backendSigner is non-zero
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13e] BanditDogFusion.backendSigner is not zero address', async () => {
    const { fusion, backendSigner } = await loadFixture(deployProductionFixture);
    const signer = await fusion.backendSigner();
    expect(signer).to.not.equal(ethers.ZeroAddress, 'backendSigner must be set for tokenize/redeem signatures');
    expect(signer).to.equal(backendSigner.address);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item 13f — FarmToken: tier2Balance < tier3Balance consistency
  // ─────────────────────────────────────────────────────────────────────────
  it('[CFG-13f] FarmToken tier thresholds are consistent: tier2Balance < tier3Balance', async () => {
    const { farm } = await loadFixture(deployProductionFixture);
    const tier2 = await farm.tier2Balance();
    const tier3 = await farm.tier3Balance();
    expect(tier2).to.be.lt(tier3, 'tier2Balance must be strictly less than tier3Balance');
    expect(tier2).to.equal(E18('10000'));
    expect(tier3).to.equal(E18('50000'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cross-contract wiring validation (end-to-end path check)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Cross-contract wiring end-to-end verification', () => {

    it('BNB revenue flow: fusion → treasury (verified by contracts pointing to same address)', async () => {
      const { fusion, barnServices, market, gateway, treasury } = await loadFixture(deployProductionFixture);
      const treasuryAddr = await treasury.getAddress();

      expect(await fusion.treasuryAddress()).to.equal(treasuryAddr);
      expect(await barnServices.treasury()).to.equal(treasuryAddr);
      expect(await market.treasury()).to.equal(treasuryAddr);
      expect(await gateway.treasuryVault()).to.equal(treasuryAddr);
    });

    it('FARM token contract is consistently wired across all contracts', async () => {
      const { farm, fusion, gateway, treasury } = await loadFixture(deployProductionFixture);
      const farmAddr = await farm.getAddress();

      expect(await fusion.farmToken()).to.equal(farmAddr);
      expect(await gateway.farmToken()).to.equal(farmAddr);
      expect(await treasury.farmToken()).to.equal(farmAddr);
    });

    it('TreasuryBuyBack immutable addresses are correctly set', async () => {
      const { treasury, farm, usdt, router, wbnb } = await loadFixture(deployProductionFixture);

      expect(await treasury.farmToken()).to.equal(await farm.getAddress());
      expect(await treasury.usdtToken()).to.equal(await usdt.getAddress());
      expect(await treasury.pancakeRouter()).to.equal(await router.getAddress());
      expect(await treasury.wbnb()).to.equal(wbnb);
      expect(await treasury.DEAD_ADDRESS()).to.equal(DEAD);
    });

    it('BanditDogFusion immutable DEAD_ADDRESS and constants match spec', async () => {
      const { fusion } = await loadFixture(deployProductionFixture);

      expect(await fusion.DEAD_ADDRESS()).to.equal(DEAD);
      expect(await fusion.SOUL_SHARD_ID()).to.equal(9999n);
      expect(await fusion.SHARDS_PER_REDEEM()).to.equal(100n);
      expect(await fusion.MAX_REDEEM_PER_TX()).to.equal(10n);
    });

    it('WalletGateway MAX_FEE_BPS = 100, CASHOUT_FEE_BPS = 100', async () => {
      const { gateway } = await loadFixture(deployProductionFixture);
      expect(await gateway.MAX_FEE_BPS()).to.equal(100n);
      expect(await gateway.CASHOUT_FEE_BPS()).to.equal(100n);
    });

    it('BarnServices default subscription prices match spec (0.005 and 0.015 BNB)', async () => {
      const { barnServices } = await loadFixture(deployProductionFixture);
      expect(await barnServices.subscriptionPrices(1)).to.equal(E18('0.005'));
      expect(await barnServices.subscriptionPrices(2)).to.equal(E18('0.015'));
    });

    it('BarnServices default subscription durations: 7 days and 30 days', async () => {
      const { barnServices } = await loadFixture(deployProductionFixture);
      expect(await barnServices.subscriptionDurations(1)).to.equal(BigInt(7 * 24 * 3600));
      expect(await barnServices.subscriptionDurations(2)).to.equal(BigInt(30 * 24 * 3600));
    });

    it('BanditMarket feeBps = 500 (5%), feeBpsBNB = 300 (3%) at deployment', async () => {
      const { market } = await loadFixture(deployProductionFixture);
      expect(await market.feeBps()).to.equal(500n);
      expect(await market.feeBpsBNB()).to.equal(300n);
    });

    it('FarmToken MAX_SUPPLY = 1 billion FARM', async () => {
      const { farm } = await loadFixture(deployProductionFixture);
      expect(await farm.MAX_SUPPLY()).to.equal(E18('1000000000'));
    });

    it('FarmToken totalSupply = MAX_SUPPLY at genesis (no burn yet)', async () => {
      const { farm } = await loadFixture(deployProductionFixture);
      expect(await farm.totalSupply()).to.equal(await farm.MAX_SUPPLY());
    });
  });
});
