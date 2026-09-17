import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { QuestDefinition, QuestType } from './entities/quest-definition.entity';
import { UserDailyQuest } from './entities/user-daily-quest.entity';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Deterministic 3-from-N selection based on userId + date
function pickDailyIndices(userId: string, dateStr: string, poolSize: number): number[] {
  const raw = userId.replace(/-/g, '') + dateStr.replace(/-/g, '');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  const picked = new Set<number>();
  let counter = 0;
  while (picked.size < Math.min(3, poolSize)) {
    picked.add(Math.abs((hash + counter * 2654435761) | 0) % poolSize);
    counter++;
  }
  return [...picked];
}

@Injectable()
export class QuestService {
  constructor(
    @InjectRepository(QuestDefinition)
    private readonly defRepo: Repository<QuestDefinition>,
    @InjectRepository(UserDailyQuest)
    private readonly questRepo: Repository<UserDailyQuest>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Get (or create) today's 3 quests for a user ──────────────────
  async getDailyQuests(userId: string) {
    const today = todayUTC();

    // Fast path: quests already created
    const existing = await this.questRepo.find({
      where: { userId, questDate: today },
      order: { questDefId: 'ASC' },
    });
    if (existing.length > 0) return this.format(existing);

    // First access of the day — assign 3 deterministic quests
    const pool = await this.defRepo.find({ order: { id: 'ASC' } });
    if (pool.length === 0) return [];

    const indices = pickDailyIndices(userId, today, pool.length);
    const chosen = indices.map((i) => pool[i]);

    await this.questRepo
      .createQueryBuilder()
      .insert()
      .into(UserDailyQuest)
      .values(chosen.map((def) => ({
        userId,
        questDefId: def.id,
        questDate: today,
        progress: 0,
        completed: false,
        claimed: false,
      })))
      .orIgnore() // no-op on duplicate (concurrent request)
      .execute();

    const created = await this.questRepo.find({
      where: { userId, questDate: today },
      order: { questDefId: 'ASC' },
    });
    return this.format(created);
  }

  // ── Called from ActionService (fire-and-forget) ───────────────────
  async onHarvest(userId: string, count = 1, goldEarned = 0): Promise<void> {
    await Promise.all([
      this.increment(userId, 'harvest_count', count),
      this.increment(userId, 'harvest_gold', goldEarned),
    ]);
  }

  async onPlant(userId: string, count = 1): Promise<void> {
    await this.increment(userId, 'plant_count', count);
  }

  async onStealAttempt(userId: string, success: boolean, goldAmount: number): Promise<void> {
    await this.increment(userId, 'steal_attempts', 1);
    if (success) {
      await Promise.all([
        this.increment(userId, 'steal_count', 1),
        this.increment(userId, 'steal_gold', goldAmount),
      ]);
    }
  }

  async onAttack(userId: string): Promise<void> {
    await this.increment(userId, 'attack_count', 1);
  }

  async onWater(userId: string, count = 1): Promise<void> {
    await this.increment(userId, 'water_count', count);
  }

  // ── Claim all completed daily quest rewards at once ──────────────
  async claimAllRewards(userId: string) {
    const today = todayUTC();
    const claimable = await this.questRepo.find({
      where: { userId, questDate: today, completed: true, claimed: false },
    });

    if (claimable.length === 0) {
      return { claimedCount: 0, totalGold: 0, totalEnergy: 0 };
    }

    let totalGold = 0;
    let totalEnergy = 0;
    for (const q of claimable) {
      const res = await this.claimReward(userId, q.id);
      totalGold += res.rewardGold;
      totalEnergy += res.rewardEnergy;
    }

    return {
      claimedCount: claimable.length,
      totalGold,
      totalEnergy,
    };
  }

  // ── Claim a single completed quest reward ────────────────────────
  async claimReward(userId: string, questId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Lock just the quest row (no join to avoid FOR UPDATE + outer join error)
      const quest = await qr.manager
        .createQueryBuilder(UserDailyQuest, 'q')
        .where('q.id = :id AND q.user_id = :userId AND q.quest_date = :today', {
          id: questId, userId, today: todayUTC(),
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!quest) throw new NotFoundException('Quest not found');
      if (!quest.completed) throw new BadRequestException('Quest not completed yet');
      if (quest.claimed) throw new BadRequestException('Reward already claimed');

      const def = await qr.manager.findOne(QuestDefinition, { where: { id: quest.questDefId } });
      if (!def) throw new NotFoundException('Quest definition not found');

      await qr.manager.update(UserDailyQuest, quest.id, { claimed: true });

      if (Number(def.rewardGold) > 0) {
        await qr.manager.increment(User, { id: userId }, 'goldBalance', Number(def.rewardGold));
      }
      if (def.rewardEnergy > 0) {
        await qr.manager.createQueryBuilder()
          .update(User)
          .set({ energy: () => `LEAST(100, "energy" + ${def.rewardEnergy})` })
          .where('id = :id', { id: userId })
          .execute();
      }

      await qr.commitTransaction();
      return {
        rewardGold: Number(def.rewardGold),
        rewardEnergy: def.rewardEnergy,
        title: def.title,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Internal: increment progress for matching quest types ────────
  private async increment(userId: string, type: QuestType, amount: number): Promise<void> {
    if (amount <= 0) return;
    const today = todayUTC();

    const allToday = await this.questRepo.find({
      where: { userId, questDate: today, completed: false },
    });

    const matching = allToday.filter((q) => q.questDef?.questType === type);

    for (const q of matching) {
      const newProgress = Number(q.progress) + amount;
      const isComplete = newProgress >= q.questDef.targetValue;
      await this.questRepo.update(q.id, {
        progress: isComplete ? q.questDef.targetValue : newProgress,
        completed: isComplete,
      });
      if (isComplete) {
        this.notificationService.notifyQuestComplete(
          userId, q.questDef.title,
          Number(q.questDef.rewardGold), q.questDef.rewardEnergy,
        ).catch(() => {});
      }
    }
  }

  private format(quests: UserDailyQuest[]) {
    return quests.map((q) => ({
      id: q.id,
      questType: q.questDef.questType,
      title: q.questDef.title,
      description: q.questDef.description,
      targetValue: q.questDef.targetValue,
      rewardGold: Number(q.questDef.rewardGold),
      rewardEnergy: q.questDef.rewardEnergy,
      iconKey: q.questDef.iconKey,
      progress: q.progress,
      completed: q.completed,
      claimed: q.claimed,
    }));
  }
}
