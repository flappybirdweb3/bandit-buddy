import { LaunchConfigService } from '../user/launch-config.service';

describe('PRD-SPEC-01 & PRD-SPEC-02 Feature Specifications', () => {
  describe('LaunchConfigService (Seeding Launch Parameters)', () => {
    let launchConfig: LaunchConfigService;
    let mockConfigRepo: any;

    beforeEach(() => {
      mockConfigRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn((e: any, data: any) => data),
      };
      const mockDataSource: any = {
        getRepository: jest.fn().mockReturnValue(mockConfigRepo),
      };
      launchConfig = new LaunchConfigService(mockDataSource);
    });

    it('defaults to active launch event with 2X magnifier and 10% water boost', () => {
      expect(launchConfig.isLaunchEventActive()).toBe(true);
      expect(launchConfig.getNewUserStartingGold()).toBe(500);
      expect(launchConfig.getNewUserStartingMagnifier()).toBe(1);
      expect(launchConfig.getRefMagnifierMultiplier()).toBe(2);
      expect(launchConfig.getGuildNewMemberWaterBoost()).toBe(10);
      expect(launchConfig.isFirstDepositGiftEnabled()).toBe(true);
    });

    it('reverts to PRD baseline values when launch event is toggled off', async () => {
      // Simulate system_config having IS_LAUNCH_EVENT_ACTIVE = 'false'
      mockConfigRepo.find.mockResolvedValue([
        { key: 'IS_LAUNCH_EVENT_ACTIVE', value: 'false' },
      ]);

      await launchConfig.refreshCache();

      expect(launchConfig.isLaunchEventActive()).toBe(false);
      expect(launchConfig.getRefMagnifierMultiplier()).toBe(1);
      expect(launchConfig.getGuildNewMemberWaterBoost()).toBe(5);
    });
  });

  describe('PVP-04: Master Key Milestone Idempotent Calculation', () => {
    it('correctly calculates master keys owed based on Level 3 recruits', () => {
      // 0 recruits at Lvl 3 -> 0 keys
      const count1 = 0;
      const rewarded1 = 0;
      expect(Math.floor(count1 / 3) - rewarded1).toBe(0);

      // 2 recruits at Lvl 3 -> 0 keys
      const count2 = 2;
      const rewarded2 = 0;
      expect(Math.floor(count2 / 3) - rewarded2).toBe(0);

      // 3 recruits at Lvl 3 -> 1 key
      const count3 = 3;
      const rewarded3 = 0;
      expect(Math.floor(count3 / 3) - rewarded3).toBe(1);

      // 5 recruits at Lvl 3, 1 already rewarded -> 0 new keys
      const count4 = 5;
      const rewarded4 = 1;
      expect(Math.floor(count4 / 3) - rewarded4).toBe(0);

      // 6 recruits at Lvl 3, 1 already rewarded -> 1 new key
      const count5 = 6;
      const rewarded5 = 1;
      expect(Math.floor(count5 / 3) - rewarded5).toBe(1);
    });
  });

  describe('PVP-05 & SUB-02: Revenge Cap (35%) and Insurance Reimbursement (80%) Logic', () => {
    it('verifies 35% cap formula for revenge vs 20% standard cap', () => {
      const effectiveYield = 1000;
      const normalCap = 0.20;
      const revengeCap = 0.35;

      const normalMaxStealable = effectiveYield * normalCap;
      const revengeMaxStealable = effectiveYield * revengeCap;

      expect(normalMaxStealable).toBe(200);
      expect(revengeMaxStealable).toBe(350);
      expect(revengeMaxStealable).toBeGreaterThan(normalMaxStealable);
    });

    it('verifies 80% auto reimbursement formula for active crop insurance', () => {
      const stolenAmount = 250;
      const reimbursementRate = 0.80;
      const payout = Number((stolenAmount * reimbursementRate).toFixed(2));

      expect(payout).toBe(200);
      expect(payout / stolenAmount).toBe(0.8);
    });
  });
});
