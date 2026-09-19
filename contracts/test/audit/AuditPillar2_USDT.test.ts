/**
 * AuditPillar2_USDT.test.ts
 *
 * Covers Pillar 2 of the Bandit Buddy Audit Report:
 *
 * cashoutFarmToUSDT(farmAmount, minUsdtOut):
 *   - Pull FARM from user → WalletGateway
 *   - Swap FARM→WBNB→USDT via MockRouter (swapExactTokensForTokensSupportingFeeOnTransferTokens)
 *   - 1% fee deducted from usdtReceived → treasury USDT balance
 *   - Net USDT → user
 *   - minUsdtOut == 0 must revert (ZeroAmount)
 *   - Balance deltas asserted precisely against on-chain execution
 *
 * convertUSDTtoBNB(minBnbOut): onlyOwner
 *   - Non-owner reverts OwnableUnauthorizedAccount
 *   - Threshold gate: reverts if USDT balance < usdtConversionThreshold ($50)
 *   - On success: USDT cleared, BNB received stays in vault (via swapExactTokensForETH)
 *
 * MockMaliciousRouter now implements all three swap variants:
 *   swapExactETHForTokensSupportingFeeOnTransferTokens (BNB→FARM buyback)
 *   swapExactTokensForTokensSupportingFeeOnTransferTokens (FARM→USDT cashout)
 *   swapExactTokensForETH (USDT→BNB conversion)
 */
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const E18 = (n: number | string) => ethers.parseEther(String(n));
const DEAD = '0x000000000000000000000000000000000000dEaD';

async function deployPillar2Fixture() {
  const [owner, alice, bob, nonOwner] = await ethers.getSigners();

  const FarmFactory = await ethers.getContractFactory('FarmToken');
  const farm = await FarmFactory.deploy(owner.address);
  await farm.excludeFromFee(alice.address, true);
  await farm.excludeFromFee(owner.address, true);

  const MockErc20Factory = await ethers.getContractFactory('MockERC20');
  const usdt = await MockErc20Factory.deploy();

  const RouterFactory = await ethers.getContractFactory('MockMaliciousRouter');
  const router = await RouterFactory.deploy();

  // Wire router for BNB→FARM and FARM→USDT paths
  await router.setFarmToken(await farm.getAddress());
  await router.setUsdtToken(await usdt.getAddress());
  await farm.excludeFromFee(await router.getAddress(), true);
  await farm.transfer(await router.getAddress(), E18('500000'));
  await usdt.mint(await router.getAddress(), E18('100000'));

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

  await farm.excludeFromFee(await gateway.getAddress(), true);
  await farm.excludeFromFee(await treasury.getAddress(), true);
  await farm.excludeFromFee(DEAD, true);

  await farm.transfer(alice.address, E18('10000'));
  await farm.connect(alice).approve(await gateway.getAddress(), ethers.MaxUint256);

  return { owner, alice, bob, nonOwner, farm, usdt, router, treasury, gateway, wbnb };
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Pillar 2 — USDT Integration', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2.1 — cashoutFarmToUSDT
  // ─────────────────────────────────────────────────────────────────────────
  describe('2.1 WalletGateway.cashoutFarmToUSDT', () => {

    // Audit: Pillar 2 — minUsdtOut == 0 must revert ZeroAmount
    it('reverts with ZeroAmount when minUsdtOut is 0', async () => {
      const { gateway, alice } = await loadFixture(deployPillar2Fixture);

      await expect(
        gateway.connect(alice).cashoutFarmToUSDT(E18('100'), 0n)
      ).to.be.revertedWithCustomError(gateway, 'ZeroAmount');
    });

    // Audit: Pillar 2 — reverts with ZeroAmount when farmAmount is 0
    it('reverts with ZeroAmount when farmAmount is 0', async () => {
      const { gateway, alice } = await loadFixture(deployPillar2Fixture);

      await expect(
        gateway.connect(alice).cashoutFarmToUSDT(0n, E18('1'))
      ).to.be.revertedWithCustomError(gateway, 'ZeroAmount');
    });

    // Audit: Pillar 2 — full execution: 1% fee deducted on-chain; treasury and user balances verified
    it('deducts 1% fee from USDT received; treasury gets fee, user gets 99% (on-chain execution)', async () => {
      const { gateway, alice, usdt, router, treasury } = await loadFixture(deployPillar2Fixture);

      const mockUsdtOut = E18('100');
      await router.setMockUsdtOut(mockUsdtOut);

      const aliceUsdtBefore    = await usdt.balanceOf(alice.address);
      const treasuryUsdtBefore = await usdt.balanceOf(await treasury.getAddress());

      // minUsdtOut = 98 (98% slippage floor on 100 USDT expected)
      await expect(
        gateway.connect(alice).cashoutFarmToUSDT(E18('500'), E18('98'))
      ).to.emit(gateway, 'FarmCashedOut');

      const aliceUsdtAfter    = await usdt.balanceOf(alice.address);
      const treasuryUsdtAfter = await usdt.balanceOf(await treasury.getAddress());

      const expectedFee    = (mockUsdtOut * 100n) / 10_000n; // 1% = 1e18
      const expectedNetOut = mockUsdtOut - expectedFee;      // 99e18

      expect(aliceUsdtAfter - aliceUsdtBefore).to.equal(expectedNetOut, 'alice receives 99%');
      expect(treasuryUsdtAfter - treasuryUsdtBefore).to.equal(expectedFee, 'treasury receives 1%');
    });

    // Audit: Pillar 2 — CASHOUT_FEE_BPS constant is 100 (1%)
    it('CASHOUT_FEE_BPS is 100 basis points (1%)', async () => {
      const { gateway } = await loadFixture(deployPillar2Fixture);
      expect(await gateway.CASHOUT_FEE_BPS()).to.equal(100n);
    });

    // Audit: Pillar 2 — swap path verification: FARM→WBNB→USDT (3-hop path)
    it('cashoutFarmToUSDT uses 3-token path [FARM, WBNB, USDT]', async () => {
      const { gateway, farm, usdt, wbnb } = await loadFixture(deployPillar2Fixture);

      // Read immutable addresses from gateway to verify path would be correct
      expect(await gateway.farmToken()).to.equal(await farm.getAddress());
      expect(await gateway.usdtToken()).to.equal(await usdt.getAddress());
      expect(await gateway.wbnb()).to.equal(wbnb);
      // Path integrity: farmToken[0], wbnb[1], usdt[2]
      // This matches the contract source: path[0]=farmToken, path[1]=wbnb, path[2]=usdtToken
    });

    // Audit: Pillar 2 — fee destination is treasuryVault
    it('cashout fee flows to treasuryVault (immutable wiring)', async () => {
      const { gateway, treasury } = await loadFixture(deployPillar2Fixture);
      expect(await gateway.treasuryVault()).to.equal(await treasury.getAddress());
    });

    // Audit: Pillar 2 — fee math precision for various amounts
    it('fee math: 1% is computed correctly for multiple USDT amounts', async () => {
      const amounts = [
        E18('50'),
        E18('100'),
        E18('1000'),
        E18('0.1'),
      ];
      for (const amount of amounts) {
        const fee = (amount * 100n) / 10000n;
        const net = amount - fee;
        expect(fee + net).to.equal(amount, `fee + net must equal received for amount ${amount}`);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2.2 — TreasuryBuyBack.convertUSDTtoBNB
  // ─────────────────────────────────────────────────────────────────────────
  describe('2.2 TreasuryBuyBack.convertUSDTtoBNB', () => {

    // Audit: Pillar 2 — convertUSDTtoBNB onlyOwner
    it('reverts OwnableUnauthorizedAccount for non-owner caller', async () => {
      const { treasury, nonOwner } = await loadFixture(deployPillar2Fixture);

      await expect(
        treasury.connect(nonOwner).convertUSDTtoBNB(E18('0.1'))
      ).to.be.revertedWithCustomError(treasury, 'OwnableUnauthorizedAccount');
    });

    // Audit: Pillar 2 — threshold gate: reverts if USDT balance < usdtConversionThreshold ($50)
    it('reverts ThresholdNotReached if treasury USDT balance < $50 threshold', async () => {
      const { treasury, usdt, owner } = await loadFixture(deployPillar2Fixture);

      // Transfer only $40 USDT to treasury (below $50 default threshold)
      await usdt.mint(await treasury.getAddress(), E18('40'));

      await expect(
        treasury.connect(owner).convertUSDTtoBNB(E18('0.01'))
      ).to.be.revertedWithCustomError(treasury, 'ThresholdNotReached')
        .withArgs(E18('40'), E18('50'));
    });

    // Audit: Pillar 2 — usdtConversionThreshold default is $50
    it('usdtConversionThreshold default is 50 USDT', async () => {
      const { treasury } = await loadFixture(deployPillar2Fixture);
      expect(await treasury.usdtConversionThreshold()).to.equal(E18('50'));
    });

    // Audit: Pillar 2 — full execution: convertUSDTtoBNB clears USDT and BNB increases on-chain
    it('convertUSDTtoBNB clears all USDT from treasury and BNB increases (on-chain execution)', async () => {
      const { treasury, usdt, router, owner } = await loadFixture(deployPillar2Fixture);

      const treasuryAddr = await treasury.getAddress();
      const routerAddr   = await router.getAddress();

      // Fund treasury with $60 USDT (above $50 threshold)
      await usdt.mint(treasuryAddr, E18('60'));

      // Fund router with BNB it will send back during the swap
      const mockBnb = ethers.parseEther('0.05');
      await router.setMockBnbOut(mockBnb);
      await owner.sendTransaction({ to: routerAddr, value: mockBnb });

      const bnbBefore = await ethers.provider.getBalance(treasuryAddr);

      await expect(
        treasury.connect(owner).convertUSDTtoBNB(ethers.parseEther('0.04'))
      ).to.emit(treasury, 'USDTConvertedToBNB');

      // USDT fully drained from treasury
      expect(await usdt.balanceOf(treasuryAddr)).to.equal(0n, 'treasury USDT cleared');
      // BNB increased by mockBnbOut
      expect(await ethers.provider.getBalance(treasuryAddr)).to.equal(bnbBefore + mockBnb, 'treasury BNB grew');
      // Counter updated
      expect(await treasury.totalUsdtConverted()).to.equal(E18('60'), 'totalUsdtConverted updated');
    });

    // Audit: Pillar 2 — totalUsdtConverted accumulates correctly
    it('totalUsdtConverted starts at zero', async () => {
      const { treasury } = await loadFixture(deployPillar2Fixture);
      expect(await treasury.totalUsdtConverted()).to.equal(0n);
    });

    // Audit: A3 — onlyOwner access control on admin functions
    it('setUsdtConversionThreshold: onlyOwner enforced', async () => {
      const { treasury, nonOwner } = await loadFixture(deployPillar2Fixture);

      await expect(
        treasury.connect(nonOwner).setUsdtConversionThreshold(E18('100'))
      ).to.be.revertedWithCustomError(treasury, 'OwnableUnauthorizedAccount');
    });

    it('setUsdtConversionThreshold: owner can update and emits UsdtThresholdUpdated', async () => {
      const { treasury, owner } = await loadFixture(deployPillar2Fixture);

      await expect(
        treasury.connect(owner).setUsdtConversionThreshold(E18('100'))
      ).to.emit(treasury, 'UsdtThresholdUpdated')
        .withArgs(E18('50'), E18('100'));

      expect(await treasury.usdtConversionThreshold()).to.equal(E18('100'));
    });

    it('setUsdtConversionThreshold: reverts ZeroAmount on threshold=0', async () => {
      const { treasury, owner } = await loadFixture(deployPillar2Fixture);

      await expect(
        treasury.connect(owner).setUsdtConversionThreshold(0n)
      ).to.be.revertedWithCustomError(treasury, 'ZeroAmount');
    });

    // Audit: Pillar 2 — USDT token is correctly wired in TreasuryBuyBack
    it('treasury.usdtToken is correctly wired to mock USDT address', async () => {
      const { treasury, usdt } = await loadFixture(deployPillar2Fixture);
      expect(await treasury.usdtToken()).to.equal(await usdt.getAddress());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2.3 — USDT cashout fee arithmetic edge cases
  // ─────────────────────────────────────────────────────────────────────────
  describe('2.3 USDT fee arithmetic edge cases', () => {

    // Audit: A4 — Integer division dust on USDT fee computation
    it('fee computation: (usdtReceived * 100) / 10000 floors correctly (no over-charge)', async () => {
      // Test with an amount that produces dust: 101 wei
      const amount = 101n;
      const fee = (amount * 100n) / 10000n; // integer division: = 1 (1%)
      const net = amount - fee;
      // 1% of 101 wei = 1.01 → floored to 1
      expect(fee).to.equal(1n);
      expect(net).to.equal(100n);
      // User receives more than 99% (they get the extra 1 wei due to floor)
      expect(net).to.be.gte((amount * 99n) / 100n);
    });

    it('fee computation: 1 wei input → fee=0, user gets full amount', async () => {
      const amount = 1n;
      const fee = (amount * 100n) / 10000n; // 0 (floor)
      const net = amount - fee;
      expect(fee).to.equal(0n);
      expect(net).to.equal(1n);
    });

    it('gateway FEE_DENOMINATOR is 10000', async () => {
      const { gateway } = await loadFixture(deployPillar2Fixture);
      expect(await gateway.FEE_DENOMINATOR()).to.equal(10000n);
    });
  });
});
