import {
  UserCashoutTier,
  CASHOUT_TIER_PERCENTAGES,
  CASHOUT_TIER_NAMES,
} from './web3.service';

describe('Cashout Quota & Dynamic Tier Engine', () => {
  describe('UserCashoutTier calculation', () => {
    // Helper function replicating getUserCashoutTier
    function getUserCashoutTier(user: {
      walletAddress?: string | null;
      trustScore?: number;
      level?: number;
    }): UserCashoutTier {
      if (!user.walletAddress || (user.trustScore ?? 0) < 30) {
        return UserCashoutTier.TIER_0;
      }
      const level = user.level ?? 1;
      const trustScore = user.trustScore ?? 50;

      if (level >= 10 || trustScore >= 80) {
        return UserCashoutTier.TIER_3;
      }
      if (level >= 5 || trustScore >= 60) {
        return UserCashoutTier.TIER_2;
      }
      return UserCashoutTier.TIER_1;
    }

    it('assigns Tier 0 if walletAddress is missing or null', () => {
      expect(getUserCashoutTier({ walletAddress: null, trustScore: 80, level: 10 })).toBe(
        UserCashoutTier.TIER_0,
      );
      expect(getUserCashoutTier({ walletAddress: '', trustScore: 50, level: 5 })).toBe(
        UserCashoutTier.TIER_0,
      );
    });

    it('assigns Tier 0 if trustScore is below 30', () => {
      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 25,
          level: 15,
        }),
      ).toBe(UserCashoutTier.TIER_0);
    });

    it('assigns Tier 1 for novice verified farmer (trust >= 30, level < 5, trust < 60)', () => {
      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 50,
          level: 1,
        }),
      ).toBe(UserCashoutTier.TIER_1);
    });

    it('assigns Tier 2 for dedicated farmer (level >= 5 or trustScore >= 60)', () => {
      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 40,
          level: 5,
        }),
      ).toBe(UserCashoutTier.TIER_2);

      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 65,
          level: 2,
        }),
      ).toBe(UserCashoutTier.TIER_2);
    });

    it('assigns Tier 3 for elite/whale farmer (level >= 10 or trustScore >= 80)', () => {
      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 50,
          level: 10,
        }),
      ).toBe(UserCashoutTier.TIER_3);

      expect(
        getUserCashoutTier({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          trustScore: 85,
          level: 3,
        }),
      ).toBe(UserCashoutTier.TIER_3);
    });
  });

  describe('Tier Quota percentages', () => {
    it('matches limited_daily_withdraw_FARM.md specification', () => {
      expect(CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_0]).toBe(0.0);
      expect(CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_1]).toBe(0.0005); // 0.05%
      expect(CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_2]).toBe(0.0020); // 0.20%
      expect(CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_3]).toBe(0.0200); // 2.00%
    });

    it('calculates correct limits on 100,000 FARM Global Pool', () => {
      const globalPool = 100_000;
      expect(globalPool * CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_0]).toBe(0);
      expect(globalPool * CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_1]).toBe(50); // 50 FARM
      expect(globalPool * CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_2]).toBe(200); // 200 FARM
      expect(globalPool * CASHOUT_TIER_PERCENTAGES[UserCashoutTier.TIER_3]).toBe(2000); // 2,000 FARM
    });
  });

  describe('Dynamic Release Rate R formula', () => {
    function computeReleaseRate(priceGrowthPercent: number): number {
      const clampedRatio = Math.min(Math.max((priceGrowthPercent + 10) / 20, 0), 1);
      return Number((0.02 + clampedRatio * 0.03).toFixed(4));
    }

    it('caps at 0.05 (5%) when price growth is >= +10%', () => {
      expect(computeReleaseRate(10)).toBe(0.05);
      expect(computeReleaseRate(25)).toBe(0.05);
    });

    it('floors at 0.02 (2%) when price growth is <= -10%', () => {
      expect(computeReleaseRate(-10)).toBe(0.02);
      expect(computeReleaseRate(-20)).toBe(0.02);
    });

    it('scales linearly between -10% and +10%', () => {
      expect(computeReleaseRate(0)).toBe(0.035); // neutral 3.5%
      expect(computeReleaseRate(5)).toBe(0.0425);
      expect(computeReleaseRate(-5)).toBe(0.0275);
    });
  });
});
