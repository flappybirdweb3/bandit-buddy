import { GuildService } from './guild.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('GuildService - World Tree Social-Fi Engine', () => {
  let service: GuildService;
  let mockGuildRepo: any;
  let mockMemberRepo: any;
  let mockSubRepo: any;
  let mockTreeContribRepo: any;
  let mockUserRepo: any;
  let mockPlotRepo: any;
  let mockSeedRepo: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockGuildRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
      find: jest.fn(),
    };
    mockMemberRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    mockSubRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    mockTreeContribRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    mockUserRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
    };
    mockPlotRepo = {};
    mockSeedRepo = {};
    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockEntityManager)),
    };

    service = new GuildService(
      mockGuildRepo,
      mockMemberRepo,
      mockSubRepo,
      mockTreeContribRepo,
      mockUserRepo,
      mockPlotRepo,
      mockSeedRepo,
      mockDataSource,
    );
  });

  const mockEntityManager = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    create: jest.fn((entity, data) => data),
    find: jest.fn(),
  };

  describe('setTaxRate', () => {
    it('enforces 1% to 5% range for elite guild masters', async () => {
      mockMemberRepo.findOne.mockResolvedValue({ userId: 'u1', guildId: 'g1', role: 'owner' });
      mockGuildRepo.findOneOrFail.mockResolvedValue({ id: 'g1', ownerId: 'u1', isElite: true });

      await expect(service.setTaxRate('u1', 0.005)).rejects.toThrow(BadRequestException);
      await expect(service.setTaxRate('u1', 0.06)).rejects.toThrow(BadRequestException);

      mockGuildRepo.update.mockResolvedValue({});
      const res = await service.setTaxRate('u1', 0.03);
      expect(res.taxRate).toBe(0.03);
    });

    it('rejects non-owner or free tier', async () => {
      mockMemberRepo.findOne.mockResolvedValue({ userId: 'u2', guildId: 'g1', role: 'member' });
      mockGuildRepo.findOneOrFail.mockResolvedValue({ id: 'g1', ownerId: 'u1', isElite: true });
      await expect(service.setTaxRate('u2', 0.03)).rejects.toThrow(ForbiddenException);

      mockMemberRepo.findOne.mockResolvedValue({ userId: 'u1', guildId: 'g1', role: 'owner' });
      mockGuildRepo.findOneOrFail.mockResolvedValue({ id: 'g1', ownerId: 'u1', isElite: false });
      await expect(service.setTaxRate('u1', 0.03)).rejects.toThrow(BadRequestException);
    });
  });

  describe('buyShield', () => {
    it('blocks free tier guilds from buying shields', async () => {
      mockMemberRepo.findOne.mockResolvedValue({ userId: 'u1', guildId: 'g1' });
      mockGuildRepo.findOneOrFail.mockResolvedValue({ id: 'g1', isElite: false });

      await expect(service.buyShield('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('setButlerPreferredSeed', () => {
    it('throws BadRequestException if no active Butler subscription', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);
      await expect(service.setButlerPreferredSeed('u1', 'seed-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if player level is below seed requirement', async () => {
      mockSubRepo.findOne.mockResolvedValue({ id: 'sub-1', userId: 'u1', type: 'butler' });
      mockSeedRepo.findOne = jest.fn().mockResolvedValue({ id: 'seed-corn', levelRequired: 5 });
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', level: 2 });

      await expect(service.setButlerPreferredSeed('u1', 'seed-corn')).rejects.toThrow(BadRequestException);
    });

    it('successfully updates preferredSeedId when eligible', async () => {
      const butlerSub = { id: 'sub-1', userId: 'u1', type: 'butler', preferredSeedId: null };
      mockSubRepo.findOne.mockResolvedValue(butlerSub);
      mockSeedRepo.findOne = jest.fn().mockResolvedValue({ id: 'seed-carrot', levelRequired: 1 });
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', level: 3 });
      mockSubRepo.save.mockResolvedValue({ ...butlerSub, preferredSeedId: 'seed-carrot' });

      const res = await service.setButlerPreferredSeed('u1', 'seed-carrot');
      expect(res.preferredSeedId).toBe('seed-carrot');
      expect(butlerSub.preferredSeedId).toBe('seed-carrot');
    });

    it('successfully clears preferredSeedId when seedId is null', async () => {
      const butlerSub = { id: 'sub-1', userId: 'u1', type: 'butler', preferredSeedId: 'seed-carrot' };
      mockSubRepo.findOne.mockResolvedValue(butlerSub);
      mockSubRepo.save.mockResolvedValue({ ...butlerSub, preferredSeedId: null });

      const res = await service.setButlerPreferredSeed('u1', null);
      expect(res.preferredSeedId).toBeNull();
      expect(butlerSub.preferredSeedId).toBeNull();
    });
  });
});
