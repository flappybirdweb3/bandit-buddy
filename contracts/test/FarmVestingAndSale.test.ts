import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { FarmToken, FarmVesting, FarmTokenSale } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const E18 = (n: number | string) => ethers.parseEther(String(n));
const toUsdt = (n: number | string) => ethers.parseEther(String(n)); // BSC USDT = 18 dec
const DAY  = 86_400n;
const now  = () => BigInt(Math.floor(Date.now() / 1000));

// ─── Fixtures ────────────────────────────────────────────────────────────────

async function deployAll() {
  const [owner, treasury, alice, bob, carol] = await ethers.getSigners();

  // FARM token
  const FarmFactory = await ethers.getContractFactory('FarmToken');
  const farm = (await FarmFactory.deploy(owner.address)) as unknown as FarmToken;
  await farm.waitForDeployment();

  // Mock USDT (reuse FarmToken factory — same ERC20 interface)
  const usdt = (await FarmFactory.deploy(owner.address)) as unknown as FarmToken;
  await usdt.waitForDeployment();

  // FarmVesting
  const VestingFactory = await ethers.getContractFactory('FarmVesting');
  const vesting = (await VestingFactory.deploy(
    await farm.getAddress(),
    owner.address,
  )) as unknown as FarmVesting;
  await vesting.waitForDeployment();

  // FarmTokenSale
  const SaleFactory = await ethers.getContractFactory('FarmTokenSale');
  const sale = (await SaleFactory.deploy(
    await usdt.getAddress(),
    await farm.getAddress(),
    await vesting.getAddress(),
    treasury.address,
    owner.address,
  )) as unknown as FarmTokenSale;
  await sale.waitForDeployment();

  // Grant CREATOR_ROLE to sale contract
  const CREATOR_ROLE = await vesting.CREATOR_ROLE();
  await vesting.grantRole(CREATOR_ROLE, await sale.getAddress());

  // Fund sale with 170M FARM
  const saleAmt = E18('170000000');
  await farm.transfer(await sale.getAddress(), saleAmt);

  // Give alice and bob USDT (unlimited for tests)
  const usdtAmt = toUsdt('1000000');
  await usdt.transfer(alice.address, usdtAmt);
  await usdt.transfer(bob.address, usdtAmt);

  return { farm, usdt, vesting, sale, owner, treasury, alice, bob, carol };
}

// Open a round starting now, lasting 30 days
async function openRound(sale: FarmTokenSale, roundId: number, owner: SignerWithAddress) {
  const start = BigInt(await time.latest()) + 1n;
  const end   = start + 30n * DAY;
  await sale.connect(owner).setRoundTimes(roundId, start, end);
  await time.increase(2); // advance past startTime
}

// ─── FarmVesting ─────────────────────────────────────────────────────────────

describe('FarmVesting', () => {
  let farm: FarmToken;
  let vesting: FarmVesting;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  beforeEach(async () => {
    const all = await deployAll();
    farm    = all.farm;
    vesting = all.vesting;
    owner   = all.owner;
    alice   = all.alice;
  });

  describe('setTge', () => {
    it('owner can set TGE once', async () => {
      const tge = BigInt(await time.latest()) + DAY;
      await expect(vesting.setTge(tge)).to.emit(vesting, 'TgeSet').withArgs(tge);
      expect(await vesting.tgeTimestamp()).to.equal(tge);
    });

    it('reverts if set twice', async () => {
      const tge = BigInt(await time.latest()) + DAY;
      await vesting.setTge(tge);
      await expect(vesting.setTge(tge + 1n)).to.be.revertedWithCustomError(vesting, 'TgeAlreadySet');
    });

    it('reverts for non-admin', async () => {
      await expect(vesting.connect(alice).setTge(1n)).to.be.reverted;
    });
  });

  describe('addSchedule', () => {
    it('creates a schedule and tracks totalAllocated', async () => {
      const amount = E18('1000');
      await farm.transfer(await vesting.getAddress(), amount);
      await vesting.addSchedule(alice.address, amount, 500, 0, 365, 'test');
      expect(await vesting.totalAllocated()).to.equal(amount);
      expect(await vesting.scheduleCount(alice.address)).to.equal(1);
    });

    it('reverts if vesting has insufficient FARM', async () => {
      await expect(
        vesting.addSchedule(alice.address, E18('1'), 0, 0, 365, 'test'),
      ).to.be.revertedWithCustomError(vesting, 'InsufficientFarmBalance');
    });

    it('reverts for tgeBps > 10000', async () => {
      await farm.transfer(await vesting.getAddress(), E18('1'));
      await expect(
        vesting.addSchedule(alice.address, E18('1'), 10_001, 0, 365, 'test'),
      ).to.be.revertedWithCustomError(vesting, 'TgeBpsExceedsMax');
    });

    it('reverts for non-CREATOR_ROLE', async () => {
      await farm.transfer(await vesting.getAddress(), E18('1'));
      await expect(
        vesting.connect(alice).addSchedule(alice.address, E18('1'), 0, 0, 365, 'test'),
      ).to.be.reverted;
    });
  });

  describe('release', () => {
    async function setupSchedule(tgeBps: number, cliffDays: number, vestingDays: number) {
      const amount = E18('10000');
      await farm.transfer(await vesting.getAddress(), amount);
      await vesting.addSchedule(alice.address, amount, tgeBps, cliffDays, vestingDays, 'test');

      const tge = BigInt(await time.latest()) + DAY;
      await vesting.setTge(tge);
      return { amount, tge };
    }

    it('nothing releasable before TGE', async () => {
      await setupSchedule(500, 0, 365);
      expect(await vesting.releasable(alice.address)).to.equal(0n);
    });

    it('releases TGE portion immediately at TGE (0% cliff)', async () => {
      const { amount, tge } = await setupSchedule(500, 0, 365); // 5% TGE
      await time.increaseTo(tge);
      const claimable = await vesting.releasable(alice.address);
      expect(claimable).to.equal(amount * 500n / 10_000n); // 5%
    });

    it('releases nothing before cliff (Angel: 0% TGE + 90d cliff)', async () => {
      const { tge } = await setupSchedule(0, 90, 540); // Angel params
      await time.increaseTo(tge + 1n); // just after TGE
      expect(await vesting.releasable(alice.address)).to.equal(0n);
      // At 89 days after TGE still nothing
      await time.increaseTo(tge + 89n * DAY);
      expect(await vesting.releasable(alice.address)).to.equal(0n);
    });

    it('starts releasing linearly after cliff', async () => {
      const { amount, tge } = await setupSchedule(0, 90, 540);
      await time.increaseTo(tge + 90n * DAY); // exactly at cliff end
      const claimable = await vesting.releasable(alice.address);
      // ~0 since 0 elapsed in vesting window
      // advance 270 days into vesting (50% through 540d)
      await time.increaseTo(tge + 90n * DAY + 270n * DAY);
      const half = await vesting.releasable(alice.address);
      expect(half).to.be.closeTo(amount / 2n, E18('1')); // within 1 FARM
    });

    it('fully releases after vesting ends', async () => {
      const { amount, tge } = await setupSchedule(500, 0, 365);
      await time.increaseTo(tge + 365n * DAY + 1n);
      await vesting.release(alice.address);
      expect(await farm.balanceOf(alice.address)).to.equal(amount);
    });

    it('reverts release if TGE not set', async () => {
      const amount = E18('1000');
      await farm.transfer(await vesting.getAddress(), amount);
      await vesting.addSchedule(alice.address, amount, 0, 0, 365, 'test');
      await expect(vesting.release(alice.address)).to.be.revertedWithCustomError(vesting, 'TgeNotSet');
    });

    it('reverts if nothing to release', async () => {
      const { tge } = await setupSchedule(0, 90, 540);
      await time.increaseTo(tge + 1n);
      await expect(vesting.release(alice.address)).to.be.revertedWithCustomError(vesting, 'NothingToRelease');
    });

    it('correctly handles multiple schedules for same beneficiary', async () => {
      const amount = E18('1000');
      await farm.transfer(await vesting.getAddress(), amount * 2n);
      await vesting.addSchedule(alice.address, amount, 0, 0, 365, 'public');
      await vesting.addSchedule(alice.address, amount, 500, 0, 365, 'private');
      const tge = BigInt(await time.latest()) + DAY;
      await vesting.setTge(tge);
      await time.increaseTo(tge + 365n * DAY + 1n);
      await vesting.release(alice.address);
      expect(await farm.balanceOf(alice.address)).to.equal(amount * 2n);
    });
  });
});

// ─── FarmTokenSale ───────────────────────────────────────────────────────────

describe('FarmTokenSale', () => {
  describe('deployment', () => {
    it('configures all three rounds with correct parameters', async () => {
      const { sale } = await deployAll();
      const [prices, allocs,, ,, tgeBpsArr, cliffArr, vestingArr] = await sale.allRoundsSummary();

      // Angel
      expect(prices[0]).to.equal(1e15);
      expect(allocs[0]).to.equal(E18('50000000'));
      expect(tgeBpsArr[0]).to.equal(500);   // V3: 5% TGE
      expect(cliffArr[0]).to.equal(90);
      expect(vestingArr[0]).to.equal(540);

      // Private
      expect(prices[1]).to.equal(2_500_000_000_000_000n);
      expect(allocs[1]).to.equal(E18('70000000'));
      expect(tgeBpsArr[1]).to.equal(500);
      expect(cliffArr[1]).to.equal(30);     // V3: 30-day cliff
      expect(vestingArr[1]).to.equal(540);

      // Public
      expect(prices[2]).to.equal(5_000_000_000_000_000n);
      expect(allocs[2]).to.equal(E18('50000000'));
      expect(tgeBpsArr[2]).to.equal(2_500);
      expect(cliffArr[2]).to.equal(0);
      expect(vestingArr[2]).to.equal(365);
    });

    it('reverts constructor with zero address', async () => {
      const [owner] = await ethers.getSigners();
      const F = await ethers.getContractFactory('FarmTokenSale');
      await expect(
        F.deploy(ethers.ZeroAddress, owner.address, owner.address, owner.address, owner.address),
      ).to.be.revertedWithCustomError(F, 'ZeroAddress');
    });
  });

  describe('setRoundTimes', () => {
    it('owner can set round times before start', async () => {
      const { sale, owner } = await deployAll();
      const start = BigInt(await time.latest()) + 100n;
      const end   = start + DAY;
      await expect(sale.connect(owner).setRoundTimes(2, start, end))
        .to.emit(sale, 'RoundUpdated').withArgs(2);
    });

    it('reverts if endTime <= startTime', async () => {
      const { sale, owner } = await deployAll();
      const t = BigInt(await time.latest()) + 100n;
      await expect(sale.connect(owner).setRoundTimes(2, t, t)).to.be.revertedWith('endTime <= startTime');
    });

    it('reverts if round already started', async () => {
      const { sale, owner } = await deployAll();
      await openRound(sale, 2, owner);
      const t = BigInt(await time.latest()) + 100n;
      await expect(sale.connect(owner).setRoundTimes(2, t, t + DAY))
        .to.be.revertedWithCustomError(sale, 'RoundAlreadyStarted');
    });

    it('reverts for invalid round id', async () => {
      const { sale, owner } = await deployAll();
      await expect(sale.connect(owner).setRoundTimes(3, 1n, 2n))
        .to.be.revertedWithCustomError(sale, 'InvalidRound');
    });
  });

  describe('buy — Public round (no whitelist)', () => {
    it('successful purchase creates vesting schedule and moves USDT to treasury', async () => {
      const { sale, usdt, vesting, owner, treasury, alice } = await deployAll();
      await openRound(sale, 2, owner); // Public round

      const usdtIn   = toUsdt('100'); // $100
      const farmOut  = E18('20000'); // $100 / $0.005 = 20,000 FARM
      await usdt.connect(alice).approve(await sale.getAddress(), usdtIn);

      const treasuryBefore = await usdt.balanceOf(treasury.address);
      await expect(sale.connect(alice).buy(2, usdtIn))
        .to.emit(sale, 'Purchased')
        .withArgs(alice.address, 2, usdtIn, farmOut, 0n);

      // USDT went to treasury
      expect(await usdt.balanceOf(treasury.address)).to.equal(treasuryBefore + usdtIn);

      // Vesting schedule created
      expect(await vesting.scheduleCount(alice.address)).to.equal(1);
      const [total, tgeAmt, cliff, vestDays] = await vesting.getSchedule(alice.address, 0);
      expect(total).to.equal(farmOut);
      expect(tgeAmt).to.equal(farmOut * 2_500n / 10_000n); // 25% TGE
      expect(cliff).to.equal(0);
      expect(vestDays).to.equal(365);
    });

    it('farmForUsdt helper returns correct amount', async () => {
      const { sale } = await deployAll();
      expect(await sale.farmForUsdt(2, toUsdt('10'))).to.equal(E18('2000'));
    });

    it('reverts if round not active', async () => {
      const { sale, usdt, alice } = await deployAll();
      await usdt.connect(alice).approve(await sale.getAddress(), toUsdt('100'));
      await expect(sale.connect(alice).buy(2, toUsdt('100')))
        .to.be.revertedWithCustomError(sale, 'RoundNotActive');
    });

    it('reverts below minimum purchase', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      const tiny = toUsdt('5'); // min is $10
      await usdt.connect(alice).approve(await sale.getAddress(), tiny);
      await expect(sale.connect(alice).buy(2, tiny))
        .to.be.revertedWithCustomError(sale, 'BelowMinPurchase');
    });

    it('reverts if usdtAmount = 0', async () => {
      const { sale, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      await expect(sale.connect(alice).buy(2, 0))
        .to.be.revertedWithCustomError(sale, 'ZeroAmount');
    });

    it('reverts when per-wallet cap exceeded', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      const cap = toUsdt('2000'); // V3: Public max is $2,000
      await usdt.connect(alice).approve(await sale.getAddress(), cap + toUsdt('10'));
      await sale.connect(alice).buy(2, cap); // reach cap
      await expect(sale.connect(alice).buy(2, toUsdt('10')))
        .to.be.revertedWithCustomError(sale, 'ExceedsWalletCap');
    });

    it('remaining() decreases after purchase', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      const allocBefore = await sale.remaining(2);
      const usdtIn = toUsdt('50');
      await usdt.connect(alice).approve(await sale.getAddress(), usdtIn);
      await sale.connect(alice).buy(2, usdtIn);
      const farmOut = E18('10000'); // $50 / $0.005
      expect(await sale.remaining(2)).to.equal(allocBefore - farmOut);
    });
  });

  describe('buy — Angel round (whitelist required)', () => {
    it('reverts for non-whitelisted buyer', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 0, owner);
      const amt = toUsdt('100');
      await usdt.connect(alice).approve(await sale.getAddress(), amt);
      await expect(sale.connect(alice).buy(0, amt))
        .to.be.revertedWithCustomError(sale, 'NotWhitelisted');
    });

    it('whitelisted buyer can purchase', async () => {
      const { sale, usdt, vesting, owner, alice } = await deployAll();
      await sale.connect(owner).addToWhitelist(0, [alice.address]);
      await openRound(sale, 0, owner);

      const usdtIn  = toUsdt('100'); // min $100 for Angel
      const farmOut = E18('100000'); // $100 / $0.001 = 100,000 FARM

      await usdt.connect(alice).approve(await sale.getAddress(), usdtIn);
      await expect(sale.connect(alice).buy(0, usdtIn))
        .to.emit(sale, 'Purchased')
        .withArgs(alice.address, 0, usdtIn, farmOut, 0n);

      expect(await vesting.scheduleCount(alice.address)).to.equal(1);
      const [, , cliff, vestDays] = await vesting.getSchedule(alice.address, 0);
      expect(cliff).to.equal(90);
      expect(vestDays).to.equal(540);
    });

    it('addToWhitelist / removeFromWhitelist work correctly', async () => {
      const { sale, owner, alice } = await deployAll();
      await sale.connect(owner).addToWhitelist(0, [alice.address]);
      expect(await sale.whitelist(0, alice.address)).to.be.true;
      await sale.connect(owner).removeFromWhitelist(0, [alice.address]);
      expect(await sale.whitelist(0, alice.address)).to.be.false;
    });

    it('reverts addToWhitelist for non-owner', async () => {
      const { sale, alice, bob } = await deployAll();
      await expect(sale.connect(alice).addToWhitelist(0, [bob.address])).to.be.reverted;
    });
  });

  describe('buy — Private round', () => {
    it('correct FARM amount at $0.0025 price', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await sale.connect(owner).addToWhitelist(1, [alice.address]);
      await openRound(sale, 1, owner);

      const usdtIn  = toUsdt('500'); // min $500
      const farmOut = E18('200000'); // $500 / $0.0025 = 200,000 FARM

      await usdt.connect(alice).approve(await sale.getAddress(), usdtIn);
      await expect(sale.connect(alice).buy(1, usdtIn))
        .to.emit(sale, 'Purchased')
        .withArgs(alice.address, 1, usdtIn, farmOut, 0n);
    });
  });

  describe('canBuy', () => {
    it('returns false/reason when round not started', async () => {
      const { sale, alice } = await deployAll();
      const [ok, reason] = await sale.canBuy(2, alice.address);
      expect(ok).to.be.false;
      expect(reason).to.equal('not started');
    });

    it('returns true when all conditions met', async () => {
      const { sale, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      const [ok] = await sale.canBuy(2, alice.address);
      expect(ok).to.be.true;
    });

    it('returns false/sold out when allocation exhausted', async () => {
      const { sale, usdt, owner, alice, bob } = await deployAll();
      // 100 FARM allocation at $1/FARM → costs exactly $100 to exhaust
      await sale.connect(owner).setRoundParams(2, E18('1'), E18('100'), toUsdt('10'), toUsdt('5000'));
      await openRound(sale, 2, owner);
      // Buy all 100 FARM: $100 USDT
      await usdt.connect(alice).approve(await sale.getAddress(), toUsdt('100'));
      await sale.connect(alice).buy(2, toUsdt('100'));
      // Now bob tries — allocation is sold out
      const [ok, reason] = await sale.canBuy(2, bob.address);
      expect(ok).to.be.false;
      expect(reason).to.equal('sold out');
    });
  });

  describe('setRoundParams', () => {
    it('owner can update price and allocation before round starts', async () => {
      const { sale, owner } = await deployAll();
      await sale.connect(owner).setRoundParams(2, E18('0.01'), E18('1000000'), toUsdt('5'), toUsdt('1000'));
      const [prices, allocs] = await sale.allRoundsSummary();
      expect(prices[2]).to.equal(E18('0.01'));
      expect(allocs[2]).to.equal(E18('1000000'));
    });
  });

  describe('setTreasury', () => {
    it('owner can change treasury', async () => {
      const { sale, owner, carol } = await deployAll();
      await expect(sale.connect(owner).setTreasury(carol.address))
        .to.emit(sale, 'TreasuryUpdated').withArgs(carol.address);
      expect(await sale.treasury()).to.equal(carol.address);
    });

    it('reverts for zero address', async () => {
      const { sale, owner } = await deployAll();
      await expect(sale.connect(owner).setTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(sale, 'ZeroAddress');
    });
  });

  describe('recoverFarm', () => {
    it('owner can recover FARM tokens', async () => {
      const { sale, farm, owner, carol } = await deployAll();
      const balance = await farm.balanceOf(await sale.getAddress());
      await expect(sale.connect(owner).recoverFarm(carol.address, balance))
        .to.emit(sale, 'FarmRecovered').withArgs(carol.address, balance);
      expect(await farm.balanceOf(carol.address)).to.equal(balance);
    });

    it('reverts if amount exceeds balance', async () => {
      const { sale, owner, carol } = await deployAll();
      const balance = await sale.farm().then(addr =>
        ethers.getContractAt('IERC20', addr).then(c => c.balanceOf(sale.getAddress()))
      );
      await expect(sale.connect(owner).recoverFarm(carol.address, balance + 1n))
        .to.be.revertedWith('amount > balance');
    });
  });

  describe('pause / unpause', () => {
    it('paused contract rejects buy', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      await sale.connect(owner).pause();
      await usdt.connect(alice).approve(await sale.getAddress(), toUsdt('100'));
      await expect(sale.connect(alice).buy(2, toUsdt('100'))).to.be.reverted;
    });

    it('unpaused contract accepts buy again', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      await sale.connect(owner).pause();
      await sale.connect(owner).unpause();
      await usdt.connect(alice).approve(await sale.getAddress(), toUsdt('10'));
      await expect(sale.connect(alice).buy(2, toUsdt('10'))).to.not.be.reverted;
    });
  });

  describe('round end time', () => {
    it('reverts after round ends', async () => {
      const { sale, usdt, owner, alice } = await deployAll();
      await openRound(sale, 2, owner);
      await time.increase(31 * 24 * 3600); // 31 days later
      await usdt.connect(alice).approve(await sale.getAddress(), toUsdt('10'));
      await expect(sale.connect(alice).buy(2, toUsdt('10')))
        .to.be.revertedWithCustomError(sale, 'RoundNotActive');
    });
  });
});
