/**
 * AuditPillar3_FarmBurns.test.ts
 *
 * Covers Pillar 3 — $FARM Burns (every path):
 *
 * ERC20 burn() paths (reduce totalSupply):
 *   - commit():           50 FARM burned
 *   - commitGolden():     50 FARM burned
 *   - commitBulk10():    450 FARM burned
 *   - requestFusion T1→T2: 20 FARM;  T2→T3: 80;  T3→T4: 250;  T4→T5: 800
 *   - +luckyBone: +50 FARM; +collar: +150 FARM  (added to fusion cost)
 *   - Divine Insurance commit: burn cost/2 immediately
 *   - tokenizeDog(x1): 15 FARM;  tokenizeDog(x3): 40 FARM
 *
 * DEAD address paths (transfer to 0x...dEaD, NOT burned via burn()):
 *   - WalletGateway.routeTokenTransfer() with FARM: 0.3% → DEAD_ADDRESS
 *   - TreasuryBuyBack.burnHeldFarm(): all held FARM → DEAD_ADDRESS
 *   - Auto-buyback swap: FARM goes directly to DEAD_ADDRESS (already tested in Pillar 1)
 *
 * FarmToken DEX Tax → treasuryBuybackPool (NOT DEAD):
 *   - Tier 1: buy 3% / sell 5%
 *   - Tier 2: buy 2% / sell 3%
 *   - Tier 3: buy 1% / sell 1.5%
 *   - Max cap: 5% (500 BPS)
 *
 * Assertion strategy per audit requirement:
 *   totalSupplyBefore - totalSupplyAfter === burnedAmount  (for ERC20 burn paths)
 *   deadBalanceAfter - deadBalanceBefore === deadSentAmount (for DEAD transfer paths)
 */
import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const E18 = (n: number | string) => ethers.parseEther(String(n));
const DEAD = '0x000000000000000000000000000000000000dEaD';

// ── Helper: sign tokenizeDog ─────────────────────────────────────────────────
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

// ── Full deployment fixture ──────────────────────────────────────────────────
async function deployFixture() {
  const [owner, backendSigner, alice, bob] = await ethers.getSigners();

  const FarmFactory = await ethers.getContractFactory('FarmToken');
  const farm = await FarmFactory.deploy(owner.address);

  const NftFactory = await ethers.getContractFactory('GuardDogNFT');
  const nft = await NftFactory.deploy(
    await farm.getAddress(),
    owner.address,
    owner.address,
    'https://cdn.example/dogs/',
  );

  const RouterFactory = await ethers.getContractFactory('MockMaliciousRouter');
  const router = await RouterFactory.deploy();
  await router.setFarmToken(await farm.getAddress());

  const MockErc20Factory = await ethers.getContractFactory('MockERC20');
  const usdt = await MockErc20Factory.deploy();

  const wbnb = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';

  const TreasuryFactory = await ethers.getContractFactory('TreasuryBuyBack');
  const treasury = await TreasuryFactory.deploy(
    await farm.getAddress(),
    await router.getAddress(),
    wbnb,
    await usdt.getAddress(),
    owner.address,
  );

  const GatewayFactory = await ethers.getContractFactory('WalletGateway');
  const gateway = await GatewayFactory.deploy(
    await treasury.getAddress() as unknown as string,
    await farm.getAddress(),
    await router.getAddress(),
    await usdt.getAddress(),
    wbnb,
    owner.address,
  );

  const FusionFactory = await ethers.getContractFactory('BanditDogFusion');
  const fusion = await FusionFactory.deploy(
    await farm.getAddress(),
    await nft.getAddress(),
    owner.address,
    backendSigner.address,
  );
  await fusion.setTreasuryAddress(await treasury.getAddress());
  await nft.setFusionContract(await fusion.getAddress());

  // Fee exclusions for test accounts
  await farm.excludeFromFee(alice.address, true);
  await farm.excludeFromFee(bob.address, true);
  await farm.excludeFromFee(owner.address, true);
  await farm.excludeFromFee(await fusion.getAddress(), true);
  await farm.excludeFromFee(await gateway.getAddress(), true);
  await farm.excludeFromFee(await treasury.getAddress(), true);
  await farm.excludeFromFee(await router.getAddress(), true);
  await farm.excludeFromFee(DEAD, true);

  // Fund accounts
  await farm.transfer(alice.address, E18('100000'));
  await farm.transfer(await router.getAddress(), E18('500000'));
  await farm.connect(alice).approve(await fusion.getAddress(), ethers.MaxUint256);
  await farm.connect(alice).approve(await gateway.getAddress(), ethers.MaxUint256);
  await nft.connect(alice).setApprovalForAll(await fusion.getAddress(), true);

  return { owner, backendSigner, alice, bob, farm, nft, router, usdt, treasury, gateway, fusion };
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Pillar 3 — $FARM Burn Paths', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.1 — commit(): 50 FARM burned (reduce totalSupply)
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.1 commit() — 50 FARM burned', () => {

    // Audit: Pillar 3 — commit(): 50 FARM burned
    it('commit() burns exactly 50 FARM from totalSupply', async () => {
      const { farm, fusion, alice } = await loadFixture(deployFixture);

      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(
        ['bytes32', 'address'], [secret, alice.address],
      );

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);

      await fusion.connect(alice).commit(commitment);

      const supplyAfter = await farm.totalSupply();
      const deadAfter   = await farm.balanceOf(DEAD);

      // ERC20 burn() reduces totalSupply
      expect(supplyBefore - supplyAfter).to.equal(E18('50'), 'totalSupply must decrease by 50 FARM');
      // DEAD balance does NOT increase — burn() != transfer to DEAD
      expect(deadAfter - deadBefore).to.equal(0n, 'DEAD address must not receive FARM via burn()');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.2 — commitGolden(): 50 FARM burned
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.2 commitGolden() — 50 FARM burned', () => {

    // Audit: Pillar 3 — commitGolden(): 50 FARM burned
    it('commitGolden() burns exactly 50 FARM from totalSupply', async () => {
      const { farm, fusion, alice } = await loadFixture(deployFixture);

      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(
        ['bytes32', 'address'], [secret, alice.address],
      );

      const supplyBefore = await farm.totalSupply();

      await fusion.connect(alice).commitGolden(commitment, ethers.ZeroAddress, { value: E18('0.002') });

      const supplyAfter = await farm.totalSupply();
      expect(supplyBefore - supplyAfter).to.equal(E18('50'), 'golden pull must burn 50 FARM (pullCost)');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.3 — commitBulk10(): 450 FARM burned
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.3 commitBulk10() — 450 FARM burned', () => {

    // Audit: Pillar 3 — commitBulk10(): 450 FARM burned
    it('commitBulk10() burns exactly 450 FARM (bulk10FarmCost = 10x with discount)', async () => {
      const { farm, fusion, alice } = await loadFixture(deployFixture);

      const secret = ethers.randomBytes(32);
      const commitment = ethers.solidityPackedKeccak256(
        ['bytes32', 'address'], [secret, alice.address],
      );

      const supplyBefore = await farm.totalSupply();

      await fusion.connect(alice).commitBulk10(
        commitment,
        ethers.ZeroAddress,
        { value: E18('0.015') }
      );

      const supplyAfter = await farm.totalSupply();
      expect(supplyBefore - supplyAfter).to.equal(E18('450'), 'bulk10 must burn 450 FARM');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.4 — requestFusion: tier-by-tier FARM burns
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.4 requestFusion() — tier FARM burns', () => {

    type FusionTierCase = { tier: number; farmCost: string; bnbFee?: string };

    const TIER_CASES: FusionTierCase[] = [
      { tier: 1, farmCost: '20' },
      { tier: 2, farmCost: '80' },
      { tier: 3, farmCost: '250' },
      { tier: 4, farmCost: '800' },
    ];

    for (const tc of TIER_CASES) {
      // Audit: Pillar 3 — requestFusion T{n}→T{n+1}: exact FARM burned
      it(`T${tc.tier}→T${tc.tier + 1} fusion: ${tc.farmCost} FARM burned from totalSupply`, async () => {
        const { farm, fusion, nft, alice } = await loadFixture(deployFixture);

        // Mint 3 base-tier dogs for alice
        await nft.mintTo(alice.address, tc.tier, 3);

        const supplyBefore = await farm.totalSupply();
        const deadBefore   = await farm.balanceOf(DEAD);

        // Use simple 2-param overload (no divine insurance)
        await fusion.connect(alice)['requestFusion(uint256,bool,bool)'](tc.tier, false, false);

        const supplyAfter = await farm.totalSupply();
        const deadAfter   = await farm.balanceOf(DEAD);

        expect(supplyBefore - supplyAfter).to.equal(
          E18(tc.farmCost),
          `T${tc.tier}→T${tc.tier + 1} must burn exactly ${tc.farmCost} FARM`,
        );
        // No transfer to DEAD — purely reduced supply via burn()
        expect(deadAfter - deadBefore).to.equal(0n, 'fusion burn reduces supply, not DEAD transfer');
      });
    }

    // Audit: Pillar 3 — +luckyBone: +50 FARM additional burn
    it('T1→T2 with luckyBone adds 50 FARM to burn (total 70 FARM)', async () => {
      const { farm, fusion, nft, alice } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      const supplyBefore = await farm.totalSupply();
      await fusion.connect(alice)['requestFusion(uint256,bool,bool)'](1, true, false);
      const supplyAfter = await farm.totalSupply();

      expect(supplyBefore - supplyAfter).to.equal(
        E18('70'), // 20 base + 50 luckyBone
        'luckyBone adds 50 FARM to burn cost',
      );
    });

    // Audit: Pillar 3 — +collar: +150 FARM additional burn
    it('T1→T2 with collar adds 150 FARM to burn (total 170 FARM)', async () => {
      const { farm, fusion, nft, alice } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      const supplyBefore = await farm.totalSupply();
      await fusion.connect(alice)['requestFusion(uint256,bool,bool)'](1, false, true);
      const supplyAfter = await farm.totalSupply();

      expect(supplyBefore - supplyAfter).to.equal(
        E18('170'), // 20 base + 150 collar
        'collar adds 150 FARM to burn cost',
      );
    });

    // Audit: Pillar 3 — luckyBone + collar: 20 + 50 + 150 = 220 FARM
    it('T1→T2 with luckyBone + collar burns 220 FARM total', async () => {
      const { farm, fusion, nft, alice } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      const supplyBefore = await farm.totalSupply();
      await fusion.connect(alice)['requestFusion(uint256,bool,bool)'](1, true, true);
      const supplyAfter = await farm.totalSupply();

      expect(supplyBefore - supplyAfter).to.equal(
        E18('220'), // 20 + 50 + 150
        'luckyBone + collar combined must burn 220 FARM for T1',
      );
    });

    // Audit: Pillar 3 — Divine Insurance: burn cost/2 immediately
    it('T1→T2 with Divine Insurance: burns exactly cost/2 immediately (not full 20)', async () => {
      const { farm, fusion, nft, alice } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);

      await fusion.connect(alice)['requestFusion(uint256,bool,bool,bool,address)'](
        1, false, false, true, ethers.ZeroAddress,
        { value: E18('0.002') }
      );

      const supplyAfter = await farm.totalSupply();
      const deadAfter   = await farm.balanceOf(DEAD);

      // cost=20 FARM, burnNow = cost/2 = 10 FARM
      expect(supplyBefore - supplyAfter).to.equal(E18('10'), 'divine insurance burns cost/2 = 10 FARM immediately');
      expect(deadAfter - deadBefore).to.equal(0n, 'immediate burn uses ERC20 burn(), not DEAD transfer');
    });

    // Audit: Pillar 3 — Divine Insurance on success: remaining 50% burned
    it('T1→T2 divine insurance: resolveFusion(success) burns remaining 50%', async () => {
      const { farm, fusion, nft, alice, backendSigner } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      const supplyBefore = await farm.totalSupply();

      await fusion.connect(alice)['requestFusion(uint256,bool,bool,bool,address)'](
        1, false, false, true, ethers.ZeroAddress,
        { value: E18('0.002') }
      );

      const supplyMid = await farm.totalSupply();
      expect(supplyBefore - supplyMid).to.equal(E18('10'), 'half burned on request');

      // Resolve as success → burns remaining 10 FARM
      const requestId = await fusion.nextRequestId() - 1n;
      await fusion.connect(backendSigner).resolveFusion(requestId, true, 0);

      const supplyFinal = await farm.totalSupply();
      // Total burned = 10 (commit) + 10 (resolve) = 20 = full fusion fee for T1
      expect(supplyBefore - supplyFinal).to.equal(E18('20'), 'full 20 FARM burned across both calls on success');
    });

    // Audit: Pillar 3 — Divine Insurance on failure: 50% retained is REFUNDED (no additional burn)
    it('T1→T2 divine insurance: resolveFusion(fail) refunds remaining 50%, does not burn', async () => {
      const { farm, fusion, nft, alice, backendSigner } = await loadFixture(deployFixture);
      await nft.mintTo(alice.address, 1, 3);

      await fusion.connect(alice)['requestFusion(uint256,bool,bool,bool,address)'](
        1, false, false, true, ethers.ZeroAddress,
        { value: E18('0.002') }
      );

      const aliceBefore = await farm.balanceOf(alice.address);
      const supplyMid   = await farm.totalSupply();

      // Resolve as failure → refund 50% back to player (no extra burn)
      const requestId = await fusion.nextRequestId() - 1n;
      await fusion.connect(backendSigner).resolveFusion(requestId, false, 30);

      const aliceAfter  = await farm.balanceOf(alice.address);
      const supplyFinal = await farm.totalSupply();

      // 10 FARM refunded to alice
      expect(aliceAfter - aliceBefore).to.equal(E18('10'), 'alice must receive 50% FARM refund on divine insurance failure');
      // Supply stays at mid (no additional burn on failure)
      expect(supplyFinal).to.equal(supplyMid, 'no additional burn on divine insurance failure — remaining 50% refunded');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.5 — tokenizeDog: FARM burn paths
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.5 tokenizeDog() — FARM burns', () => {

    // Audit: Pillar 3 — tokenizeDog(x1): 15 FARM burned
    it('tokenizeDog x1 burns 15 FARM from totalSupply', async () => {
      const { farm, fusion, alice, backendSigner } = await loadFixture(deployFixture);

      const nonce = 10n;
      const sig = await signTokenize(backendSigner, alice.address, 1n, nonce);

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);

      await fusion.connect(alice).tokenizeDog(1, nonce, sig, { value: E18('0.002') });

      const supplyAfter = await farm.totalSupply();
      const deadAfter   = await farm.balanceOf(DEAD);

      expect(supplyBefore - supplyAfter).to.equal(E18('15'), 'tokenize x1 must burn 15 FARM');
      expect(deadAfter - deadBefore).to.equal(0n, 'tokenize uses burn(), not DEAD transfer');
    });

    // Audit: Pillar 3 — tokenizeDog(x3): 40 FARM burned
    it('tokenizeDog x3 bulk burns 40 FARM from totalSupply', async () => {
      const { farm, fusion, alice, backendSigner } = await loadFixture(deployFixture);

      const nonce = 11n;
      const sig = await signTokenize(backendSigner, alice.address, 3n, nonce);

      const supplyBefore = await farm.totalSupply();

      await fusion.connect(alice).tokenizeDog(3, nonce, sig, { value: E18('0.005') });

      const supplyAfter = await farm.totalSupply();
      expect(supplyBefore - supplyAfter).to.equal(E18('40'), 'tokenize x3 must burn 40 FARM');
    });

    it('tokenizeCost is 15 FARM and tokenizeCost3x is 40 FARM (config check)', async () => {
      const { fusion } = await loadFixture(deployFixture);
      expect(await fusion.tokenizeCost()).to.equal(E18('15'));
      expect(await fusion.tokenizeCost3x()).to.equal(E18('40'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.6 — DEAD address path: routeTokenTransfer FARM → DEAD
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.6 WalletGateway.routeTokenTransfer — FARM 0.3% fee → DEAD', () => {

    // Audit: Pillar 3 — WalletGateway FARM transfer: 0.3% → DEAD_ADDRESS
    it('FARM routeTokenTransfer: 0.3% fee goes to DEAD, totalSupply unchanged (transfer not burn)', async () => {
      const { farm, gateway, alice, bob } = await loadFixture(deployFixture);

      const amount = E18('1000');
      const expectedFee = (amount * 30n) / 10000n; // 0.3% = 3 FARM
      const expectedNet = amount - expectedFee;

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);

      await gateway.connect(alice).routeTokenTransfer(await farm.getAddress(), bob.address, amount);

      const supplyAfter = await farm.totalSupply();
      const deadAfter   = await farm.balanceOf(DEAD);

      // transfer to DEAD != burn: totalSupply unchanged
      expect(supplyAfter).to.equal(supplyBefore, 'totalSupply must NOT decrease: DEAD transfer ≠ burn()');
      // DEAD address balance increases by fee
      expect(deadAfter - deadBefore).to.equal(expectedFee, 'DEAD must receive exactly 0.3% of FARM transfer');
      // Recipient receives net
      expect(await farm.balanceOf(bob.address)).to.equal(expectedNet);
    });

    // Audit: Pillar 3 — separation: burn() reduces supply; DEAD transfer does not
    it('burn() vs DEAD transfer: they are separate accounting paths', async () => {
      const { farm, gateway, alice, bob } = await loadFixture(deployFixture);

      // Verify the two paths produce different supply changes
      const amount = E18('100');
      const burnAmt = E18('50');

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);

      // Path 1: ERC20 burn (reduces totalSupply)
      await farm.connect(alice).burn(burnAmt);

      const supplyMid = await farm.totalSupply();
      const deadMid   = await farm.balanceOf(DEAD);

      expect(supplyBefore - supplyMid).to.equal(burnAmt, 'burn() reduces totalSupply');
      expect(deadMid - deadBefore).to.equal(0n, 'burn() does not go to DEAD address');

      // Path 2: DEAD transfer via gateway (does NOT reduce totalSupply)
      await gateway.connect(alice).routeTokenTransfer(await farm.getAddress(), bob.address, amount);

      const supplyFinal = await farm.totalSupply();
      const deadFinal   = await farm.balanceOf(DEAD);

      const feeToDeadOnTransfer = (amount * 30n) / 10000n;
      expect(supplyMid - supplyFinal).to.equal(0n, 'DEAD transfer does NOT change totalSupply');
      expect(deadFinal - deadMid).to.equal(feeToDeadOnTransfer, 'DEAD balance increases by transfer fee');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.7 — TreasuryBuyBack.burnHeldFarm() → DEAD address
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.7 TreasuryBuyBack.burnHeldFarm — FARM held → DEAD', () => {

    // Audit: Pillar 3 — TreasuryBuyBack.burnHeldFarm(): all held FARM → DEAD_ADDRESS
    it('burnHeldFarm sends all treasury FARM to DEAD, totalSupply unchanged', async () => {
      const { farm, treasury, owner } = await loadFixture(deployFixture);

      // Transfer FARM to treasury (simulating fee routing)
      const farmAmount = E18('5000');
      await farm.transfer(await treasury.getAddress(), farmAmount);

      const supplyBefore = await farm.totalSupply();
      const deadBefore   = await farm.balanceOf(DEAD);
      const tBal         = await farm.balanceOf(await treasury.getAddress());

      expect(tBal).to.equal(farmAmount);

      await expect(treasury.connect(owner).burnHeldFarm())
        .to.emit(treasury, 'DirectBurn')
        .withArgs(farmAmount);

      const supplyAfter = await farm.totalSupply();
      const deadAfter   = await farm.balanceOf(DEAD);

      // safeTransfer to DEAD — supply unchanged, DEAD balance up
      expect(supplyAfter).to.equal(supplyBefore, 'burnHeldFarm uses safeTransfer to DEAD; totalSupply stays same');
      expect(deadAfter - deadBefore).to.equal(farmAmount, 'all FARM must land in DEAD address');
      expect(await farm.balanceOf(await treasury.getAddress())).to.equal(0n, 'treasury FARM balance cleared');

      expect(await treasury.totalBurned()).to.equal(farmAmount, 'totalBurned accumulator updated');
    });

    it('burnHeldFarm reverts InsufficientBalance when treasury has no FARM', async () => {
      const { treasury, owner } = await loadFixture(deployFixture);
      await expect(treasury.connect(owner).burnHeldFarm())
        .to.be.revertedWithCustomError(treasury, 'InsufficientBalance');
    });

    it('burnHeldFarm is onlyOwner', async () => {
      const { treasury, alice } = await loadFixture(deployFixture);
      await expect(treasury.connect(alice).burnHeldFarm())
        .to.be.revertedWithCustomError(treasury, 'OwnableUnauthorizedAccount');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.8 — FarmToken DEX Tax → treasuryBuybackPool
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.8 FarmToken DEX Tax — tiered rates, destination = treasuryBuybackPool', () => {

    async function deployTaxFixture() {
      const [owner, pancakePairSim, treasury, buyer, bigHolder] = await ethers.getSigners();

      const FarmFactory = await ethers.getContractFactory('FarmToken');
      const farm = await FarmFactory.deploy(owner.address);

      // Set up PancakePair and treasury
      await farm.setPancakePair(pancakePairSim.address);
      await farm.setTreasuryBuybackPool(treasury.address);

      // Exclude treasury from fee to keep test clean
      await farm.excludeFromFee(treasury.address, true);

      // Give pair tokens to simulate DEX
      await farm.transfer(pancakePairSim.address, E18('1000000'));

      return { farm, owner, pancakePairSim, treasury, buyer, bigHolder };
    }

    // Audit: Pillar 3 — Tier 1 buy 3%: balanceOf buyer < 10,000 FARM
    it('Tier 1 buy: 3% tax on purchase when buyer holds < 10,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, buyer } = await loadFixture(deployTaxFixture);

      // buyer starts with 0 FARM → Tier 1 (hold < tier2Balance = 10,000)
      const buyAmount = E18('100');
      const expectedTax = (buyAmount * 300n) / 10000n; // 3% = 3 FARM
      const expectedNet = buyAmount - expectedTax;

      const treasuryBefore = await farm.balanceOf(treasury.address);

      // Simulate buy: transfer FROM pancakePair TO buyer
      await farm.connect(pancakePairSim).transfer(buyer.address, buyAmount);

      const treasuryAfter = await farm.balanceOf(treasury.address);
      expect(await farm.balanceOf(buyer.address)).to.equal(expectedNet, 'buyer receives amount minus 3% tax');
      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'treasury receives 3% tax on Tier1 buy');
    });

    // Audit: Pillar 3 — Tier 1 sell 5%: balanceOf seller < 10,000 FARM
    it('Tier 1 sell: 5% tax on sale when seller holds < 10,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, buyer } = await loadFixture(deployTaxFixture);

      // Give buyer < 10,000 FARM (Tier 1)
      await farm.excludeFromFee(buyer.address, true);
      await farm.transfer(buyer.address, E18('500'));
      await farm.excludeFromFee(buyer.address, false);

      const sellAmount = E18('100');
      const expectedTax = (sellAmount * 500n) / 10000n; // 5% = 5 FARM
      const expectedNet = sellAmount - expectedTax;

      const treasuryBefore = await farm.balanceOf(treasury.address);
      const pairBefore     = await farm.balanceOf(pancakePairSim.address);

      // Simulate sell: transfer FROM buyer TO pancakePair
      await farm.connect(buyer).transfer(pancakePairSim.address, sellAmount);

      const treasuryAfter = await farm.balanceOf(treasury.address);
      const pairAfter     = await farm.balanceOf(pancakePairSim.address);

      expect(pairAfter - pairBefore).to.equal(expectedNet, 'pair receives 95% of sell amount');
      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'treasury receives 5% tax on Tier1 sell');
    });

    // Audit: Pillar 3 — Tier 2 buy 2%: 10,000 ≤ balance < 50,000 FARM
    it('Tier 2 buy: 2% tax when buyer holds 10,000–50,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, buyer } = await loadFixture(deployTaxFixture);

      // Pre-load buyer with 15,000 FARM (Tier 2) tax-free
      await farm.excludeFromFee(buyer.address, true);
      await farm.transfer(buyer.address, E18('15000'));
      await farm.excludeFromFee(buyer.address, false);

      const buyAmount = E18('1000');
      const expectedTax = (buyAmount * 200n) / 10000n; // 2% = 20 FARM

      const treasuryBefore = await farm.balanceOf(treasury.address);
      await farm.connect(pancakePairSim).transfer(buyer.address, buyAmount);
      const treasuryAfter = await farm.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'Tier2 buy tax must be 2%');
    });

    // Audit: Pillar 3 — Tier 2 sell 3%
    it('Tier 2 sell: 3% tax when seller holds 10,000–50,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, buyer } = await loadFixture(deployTaxFixture);

      await farm.excludeFromFee(buyer.address, true);
      await farm.transfer(buyer.address, E18('20000'));
      await farm.excludeFromFee(buyer.address, false);

      const sellAmount = E18('1000');
      const expectedTax = (sellAmount * 300n) / 10000n; // 3%

      const treasuryBefore = await farm.balanceOf(treasury.address);
      await farm.connect(buyer).transfer(pancakePairSim.address, sellAmount);
      const treasuryAfter = await farm.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'Tier2 sell tax must be 3%');
    });

    // Audit: Pillar 3 — Tier 3 buy 1%: balance >= 50,000 FARM
    it('Tier 3 buy: 1% tax when buyer holds >= 50,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, bigHolder } = await loadFixture(deployTaxFixture);

      await farm.excludeFromFee(bigHolder.address, true);
      await farm.transfer(bigHolder.address, E18('60000'));
      await farm.excludeFromFee(bigHolder.address, false);

      const buyAmount = E18('1000');
      const expectedTax = (buyAmount * 100n) / 10000n; // 1%

      const treasuryBefore = await farm.balanceOf(treasury.address);
      await farm.connect(pancakePairSim).transfer(bigHolder.address, buyAmount);
      const treasuryAfter = await farm.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'Tier3 buy tax must be 1%');
    });

    // Audit: Pillar 3 — Tier 3 sell 1.5%
    it('Tier 3 sell: 1.5% tax when seller holds >= 50,000 FARM', async () => {
      const { farm, pancakePairSim, treasury, bigHolder } = await loadFixture(deployTaxFixture);

      await farm.excludeFromFee(bigHolder.address, true);
      await farm.transfer(bigHolder.address, E18('60000'));
      await farm.excludeFromFee(bigHolder.address, false);

      const sellAmount = E18('1000');
      const expectedTax = (sellAmount * 150n) / 10000n; // 1.5%

      const treasuryBefore = await farm.balanceOf(treasury.address);
      await farm.connect(bigHolder).transfer(pancakePairSim.address, sellAmount);
      const treasuryAfter = await farm.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax, 'Tier3 sell tax must be 1.5%');
    });

    // Audit: Pillar 3 — Tax destination is treasuryBuybackPool (NOT DEAD)
    it('DEX tax goes to treasuryBuybackPool, not DEAD address', async () => {
      const { farm, pancakePairSim, treasury, buyer } = await loadFixture(deployTaxFixture);

      const deadBefore = await farm.balanceOf(DEAD);
      await farm.connect(pancakePairSim).transfer(buyer.address, E18('100'));

      const deadAfter = await farm.balanceOf(DEAD);
      expect(deadAfter).to.equal(deadBefore, 'DEX tax must NOT go to DEAD address');
      expect(await farm.treasuryBuybackPool()).to.equal(treasury.address, 'tax routes to treasuryBuybackPool');
    });

    // Audit: Pillar 3 — Max cap 5% (500 BPS)
    it('MAX_TAX_BPS is 500 (5% hard cap)', async () => {
      const { farm } = await loadFixture(deployTaxFixture);
      expect(await farm.MAX_TAX_BPS()).to.equal(500n);
    });

    // Audit: Pillar 3 — setTaxRates rejects above 5%
    it('setTaxRates reverts if any rate exceeds 500 BPS (5%)', async () => {
      const { farm, owner } = await loadFixture(deployTaxFixture);

      await expect(
        farm.connect(owner).setTaxRates(600, 200, 100, 500, 300, 150)
      ).to.be.revertedWith('FarmToken: tax exceeds 5%');
    });

    // Audit: Pillar 3 — Tax tier thresholds default values
    it('tier thresholds: tier2Balance = 10,000 FARM, tier3Balance = 50,000 FARM', async () => {
      const { farm } = await loadFixture(deployTaxFixture);
      expect(await farm.tier2Balance()).to.equal(E18('10000'));
      expect(await farm.tier3Balance()).to.equal(E18('50000'));
    });

    // Audit: Pillar 3 — wallet-to-wallet (non-DEX) transfer is NOT taxed
    it('wallet-to-wallet transfer (no DEX pair) is NOT taxed', async () => {
      const { farm, owner, buyer, bigHolder } = await loadFixture(deployTaxFixture);

      // buyer and bigHolder are not pair — transfer between them should have no tax
      await farm.transfer(buyer.address, E18('1000')); // owner excluded
      const balBefore = await farm.balanceOf(bigHolder.address);

      await farm.connect(buyer).transfer(bigHolder.address, E18('100'));

      const balAfter = await farm.balanceOf(bigHolder.address);
      expect(balAfter - balBefore).to.equal(E18('100'), 'wallet-to-wallet: no tax applied');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3.9 — pullCost default values
  // ─────────────────────────────────────────────────────────────────────────
  describe('3.9 Default FARM cost configuration', () => {
    it('pullCost = 50 FARM', async () => {
      const { fusion } = await loadFixture(deployFixture);
      expect(await fusion.pullCost()).to.equal(E18('50'));
    });

    it('bulk10FarmCost = 450 FARM (10% discount)', async () => {
      const { fusion } = await loadFixture(deployFixture);
      expect(await fusion.bulk10FarmCost()).to.equal(E18('450'));
    });

    it('fusionFee T1 = 20 FARM, T2 = 80 FARM, T3 = 250 FARM, T4 = 800 FARM', async () => {
      const { fusion } = await loadFixture(deployFixture);
      expect(await fusion.fusionFees(1)).to.equal(E18('20'));
      expect(await fusion.fusionFees(2)).to.equal(E18('80'));
      expect(await fusion.fusionFees(3)).to.equal(E18('250'));
      expect(await fusion.fusionFees(4)).to.equal(E18('800'));
    });

    it('luckyBoneFee = 50 FARM, collarFee = 150 FARM', async () => {
      const { fusion } = await loadFixture(deployFixture);
      expect(await fusion.luckyBoneFee()).to.equal(E18('50'));
      expect(await fusion.collarFee()).to.equal(E18('150'));
    });
  });
});
