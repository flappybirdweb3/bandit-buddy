import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const parseEther = (n: number | string) => ethers.parseEther(String(n));
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

describe('TreasuryBuyBack — Auto Buy-back & Burn Mechanism', () => {
  async function deployFixture() {
    const [owner, caller, donor, attacker] = await ethers.getSigners();

    // 1. Deploy FarmToken ($FARM)
    const FarmTokenFactory = await ethers.getContractFactory('FarmToken');
    const farmToken = await FarmTokenFactory.deploy(owner.address);

    // 2. Deploy Mock Router
    const MockRouterFactory = await ethers.getContractFactory('MockMaliciousRouter');
    const router = await MockRouterFactory.deploy();

    const wbnbAddress = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';

    // Deploy mock USDT (reuse FarmToken as ERC20 stand-in for tests)
    const MockUsdtFactory = await ethers.getContractFactory('FarmToken');
    const mockUsdt = await MockUsdtFactory.deploy(owner.address);

    // 3. Deploy TreasuryBuyBack
    const TreasuryFactory = await ethers.getContractFactory('TreasuryBuyBack');
    const treasury = await TreasuryFactory.deploy(
      await farmToken.getAddress(),
      await router.getAddress(),
      wbnbAddress,
      await mockUsdt.getAddress(),
      owner.address
    );

    // Configure router with farmToken
    await router.setFarmToken(await farmToken.getAddress());
    // Fund router with FARM tokens to simulate DEX liquidity
    await farmToken.connect(owner).transfer(await router.getAddress(), parseEther(1_000_000));

    return { farmToken, mockUsdt, router, treasury, owner, caller, donor, attacker, wbnbAddress };
  }

  describe('Deployment & Initial State', () => {
    it('sets initial parameters correctly', async () => {
      const { treasury, farmToken, router, wbnbAddress, owner } = await loadFixture(deployFixture);

      expect(await treasury.farmToken()).to.equal(await farmToken.getAddress());
      expect(await treasury.pancakeRouter()).to.equal(await router.getAddress());
      expect(await treasury.wbnb()).to.equal(wbnbAddress);
      expect(await treasury.owner()).to.equal(owner.address);
      expect(await treasury.buyBackThreshold()).to.equal(parseEther(2));
      expect(await treasury.slippageBps()).to.equal(600n);
      expect(await treasury.totalBurned()).to.equal(0n);
      expect(await treasury.totalBnbSpent()).to.equal(0n);
      expect(await treasury.DEAD_ADDRESS()).to.equal(DEAD_ADDRESS);
    });

    it('reverts deployment with zero addresses', async () => {
      const { farmToken, router, owner } = await loadFixture(deployFixture);
      const TreasuryFactory = await ethers.getContractFactory('TreasuryBuyBack');

      await expect(
        TreasuryFactory.deploy(ethers.ZeroAddress, await router.getAddress(), ethers.ZeroAddress, ethers.ZeroAddress, owner.address)
      ).to.be.revertedWithCustomError(TreasuryFactory, 'InvalidAddress');
    });
  });

  describe('Receiving Funds (The Vault)', () => {
    it('accepts incoming BNB and emits FundsReceived event', async () => {
      const { treasury, donor } = await loadFixture(deployFixture);

      await expect(
        donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(1.5) })
      )
        .to.emit(treasury, 'FundsReceived')
        .withArgs(donor.address, parseEther(1.5));

      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(parseEther(1.5));
    });
  });

  describe('triggerBuyBack() — Threshold-Based Auto Buy-back', () => {
    it('reverts with ThresholdNotReached if contract balance < buyBackThreshold', async () => {
      const { treasury, donor, caller } = await loadFixture(deployFixture);

      // Deposit 1.5 BNB (below 2 BNB threshold)
      await donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(1.5) });

      await expect(treasury.connect(caller).triggerBuyBack())
        .to.be.revertedWithCustomError(treasury, 'ThresholdNotReached')
        .withArgs(parseEther(1.5), parseEther(2));
    });

    it('successfully swaps and burns when balance >= buyBackThreshold', async () => {
      const { treasury, farmToken, router, donor, caller } = await loadFixture(deployFixture);

      // Set mock swap output: 100,000 FARM tokens
      const expectedFarmOut = parseEther(100_000);
      await router.setMockFarmOut(expectedFarmOut);

      // Deposit 2.5 BNB (>= 2 BNB threshold)
      await donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(2.5) });

      const deadBefore = await farmToken.balanceOf(DEAD_ADDRESS);

      // Anyone (backend worker or community keeper) can trigger once threshold is met
      await expect(treasury.connect(caller).triggerBuyBack())
        .to.emit(treasury, 'BuyBackAndBurned')
        .withArgs(parseEther(2.5), expectedFarmOut);

      // Check dead address received tokens
      const deadAfter = await farmToken.balanceOf(DEAD_ADDRESS);
      expect(deadAfter - deadBefore).to.equal(expectedFarmOut);

      // Check accounting
      expect(await treasury.totalBurned()).to.equal(expectedFarmOut);
      expect(await treasury.totalBnbSpent()).to.equal(parseEther(2.5));
      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(0n);
    });
  });

  describe('executeBuyBack() — Manual Owner Execution', () => {
    it('allows owner to manually execute buyback with specified BNB amount', async () => {
      const { treasury, farmToken, router, donor, owner } = await loadFixture(deployFixture);

      const expectedFarmOut = parseEther(50_000);
      await router.setMockFarmOut(expectedFarmOut);

      await donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(3.0) });

      await expect(treasury.connect(owner).executeBuyBack(parseEther(1.0), 0))
        .to.emit(treasury, 'BuyBackAndBurned')
        .withArgs(parseEther(1.0), expectedFarmOut);

      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(parseEther(2.0));
      expect(await treasury.totalBurned()).to.equal(expectedFarmOut);
    });

    it('rejects non-owner callers for executeBuyBack', async () => {
      const { treasury, caller } = await loadFixture(deployFixture);

      await expect(
        treasury.connect(caller).executeBuyBack(parseEther(1.0), 0)
      ).to.be.revertedWithCustomError(treasury, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Direct Burn & Held Tokens', () => {
    it('allows owner to burn held FARM tokens', async () => {
      const { treasury, farmToken, owner } = await loadFixture(deployFixture);

      // Send 5,000 FARM directly to treasury
      await farmToken.connect(owner).transfer(await treasury.getAddress(), parseEther(5_000));
      expect(await farmToken.balanceOf(await treasury.getAddress())).to.equal(parseEther(5_000));

      const deadBefore = await farmToken.balanceOf(DEAD_ADDRESS);
      await expect(treasury.connect(owner).burnHeldFarm())
        .to.emit(treasury, 'DirectBurn')
        .withArgs(parseEther(5_000));

      const deadAfter = await farmToken.balanceOf(DEAD_ADDRESS);
      expect(deadAfter - deadBefore).to.equal(parseEther(5_000));
      expect(await farmToken.balanceOf(await treasury.getAddress())).to.equal(0n);
    });
  });

  describe('Configuration & Admin Operations', () => {
    it('allows owner to update buyBackThreshold', async () => {
      const { treasury, owner } = await loadFixture(deployFixture);

      await expect(treasury.connect(owner).setBuyBackThreshold(parseEther(1.0)))
        .to.emit(treasury, 'ThresholdUpdated')
        .withArgs(parseEther(2.0), parseEther(1.0));

      expect(await treasury.buyBackThreshold()).to.equal(parseEther(1.0));
    });

    it('allows owner to update slippage tolerance', async () => {
      const { treasury, owner } = await loadFixture(deployFixture);

      await expect(treasury.connect(owner).setSlippage(300))
        .to.emit(treasury, 'SlippageUpdated')
        .withArgs(600n, 300n);

      expect(await treasury.slippageBps()).to.equal(300n);
    });

    it('reverts if slippage exceeds 10% (1000 bps)', async () => {
      const { treasury, owner } = await loadFixture(deployFixture);

      await expect(treasury.connect(owner).setSlippage(1001))
        .to.be.revertedWithCustomError(treasury, 'SlippageTooHigh');
    });

    it('allows emergency pause and blocks buybacks while paused', async () => {
      const { treasury, owner, donor, caller } = await loadFixture(deployFixture);

      await donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(2.5) });

      await treasury.connect(owner).pause();
      expect(await treasury.paused()).to.be.true;

      await expect(treasury.connect(caller).triggerBuyBack())
        .to.be.revertedWithCustomError(treasury, 'EnforcedPause');

      await treasury.connect(owner).unpause();
      expect(await treasury.paused()).to.be.false;

      await expect(treasury.connect(caller).triggerBuyBack()).to.not.be.reverted;
    });

    it('allows owner to recover BNB in emergency', async () => {
      const { treasury, owner, donor } = await loadFixture(deployFixture);

      await donor.sendTransaction({ to: await treasury.getAddress(), value: parseEther(1.0) });

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const tx = await treasury.connect(owner).recoverBNB(parseEther(1.0));
      const receipt = await tx.wait();
      const gasSpent = receipt!.gasUsed * receipt!.gasPrice;

      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter + gasSpent - ownerBefore).to.equal(parseEther(1.0));
    });
  });
});
