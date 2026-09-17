import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { UserNotification, NotifType } from './entities/user-notification.entity';

const INBOX_LIMIT = 30;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly botToken: string;
  private readonly botUsername: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)        private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(UserNotification) private readonly notifRepo: Repository<UserNotification>,
  ) {
    this.botToken    = config.get<string>('telegram.botToken') ?? '';
    this.botUsername = config.get<string>('telegram.botUsername') ?? 'BanditBuddyBot';
  }

  // ── Core Telegram push ────────────────────────────────────────────
  async send(telegramId: number, text: string, buttonText = '🥷 Open BarnBuddy', startParam = 'open'): Promise<void> {
    if (!this.botToken || this.botToken === 'your_telegram_bot_token_here') {
      this.logger.warn(`[Notification] BOT_TOKEN not set — skipping Telegram push to ${telegramId}`);
      return;
    }
    try {
      const url  = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const body = {
        chat_id:      telegramId,
        text,
        parse_mode:   'HTML',
        reply_markup: {
          inline_keyboard: [[{
            text: buttonText,
            url:  `https://t.me/${this.botUsername}?startapp=${startParam}`,
          }]],
        },
      };
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn(`[Notification] Telegram API ${res.status}: ${await res.text()}`);
      }
    } catch (e) {
      this.logger.error(`[Notification] fetch failed: ${e}`);
    }
  }

  // ── In-app inbox ──────────────────────────────────────────────────
  async createInApp(userId: string, type: NotifType, title: string, body: string, actorUserId?: string, actorUsername?: string): Promise<void> {
    try {
      await this.notifRepo.insert({ userId, type, title, body, actorUserId: actorUserId ?? null, actorUsername: actorUsername ?? null });
      // Trim to INBOX_LIMIT per user
      await this.notifRepo
        .createQueryBuilder()
        .delete()
        .where(`user_id = :userId AND id NOT IN (
          SELECT id FROM user_notifications
          WHERE user_id = :userId
          ORDER BY created_at DESC
          LIMIT ${INBOX_LIMIT}
        )`, { userId })
        .execute();
    } catch (e) {
      this.logger.error(`[Notification] createInApp failed: ${e}`);
    }
  }

  async getInbox(userId: string) {
    const items = await this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: INBOX_LIMIT,
    });
    const unreadCount = items.filter((n) => !n.isRead).length;
    return { unreadCount, items };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async clearAll(userId: string): Promise<void> {
    await this.notifRepo.delete({ userId });
  }

  // ── Event helpers ─────────────────────────────────────────────────

  async notifyStealVictim(
    victimTelegramId: number,
    victimUserId: string,
    thiefUsername: string,
    amount: number,
    thiefUserId?: string,
    insuranceReimbursed?: number,
  ): Promise<void> {
    const insuranceMsg = insuranceReimbursed && insuranceReimbursed > 0
      ? `\n\n🛡️ <b>CROP INSURANCE PAYOUT:</b> You were automatically reimbursed <b>+${insuranceReimbursed.toFixed(1)} GOLD (80%)</b> directly to your account!`
      : '';

    const text =
      `🚨 <b>FARM RAID ALERT!</b>\n\n` +
      `🥷 <b>@${thiefUsername}</b> slipped past your defenses and stole <b>${amount.toFixed(1)} GOLD</b>!${insuranceMsg}\n\n` +
      `🔍 <i>Check your Guard Dogs, harvest remaining crops, or use Detective Glasses to launch Revenge!</i>`;

    const inAppSub = insuranceReimbursed && insuranceReimbursed > 0
      ? `They stole ${amount.toFixed(1)}G (🛡️ Insurance reimbursed +${insuranceReimbursed.toFixed(1)}G).`
      : `They stole ${amount.toFixed(1)}G from your farm.`;

    await Promise.all([
      this.send(victimTelegramId, text, '⚔️ Open Farm & Revenge', 'revenge'),
      this.createInApp(victimUserId, 'steal_victim',
        `🥷 Raided by @${thiefUsername}`,
        inAppSub,
        thiefUserId, thiefUsername),
    ]);
  }

  async notifyDogBiteOwner(ownerUserId: string, thiefUsername: string, goldDropped: number, ownerTelegramId?: number): Promise<void> {
    if (goldDropped <= 0) return;
    const promises: Promise<any>[] = [
      this.createInApp(ownerUserId, 'dog_bite_owner',
        `🐕 Your dog bit @${thiefUsername}!`,
        `They dropped ${goldDropped.toFixed(1)}G trying to raid you.`),
    ];
    if (ownerTelegramId) {
      const text =
        `🐕💥 <b>GOOD BOY! Guard Dog Defended Your Farm!</b>\n\n` +
        `🥷 <b>@${thiefUsername}</b> tried to raid your plots, but your faithful Guard Dog intercepted and bit them!\n\n` +
        `💰 The thief dropped <b>+${goldDropped.toFixed(1)} GOLD</b> compensation into your account!`;
      promises.push(this.send(ownerTelegramId, text, '🐕 View Dog & Farm', 'dogs'));
    }
    await Promise.all(promises);
  }

  async notifyAttackVictim(victimUserId: string, attackerUsername: string, type: 'bugs' | 'weeds'): Promise<void> {
    const emoji = type === 'bugs' ? '🐛' : '🌿';
    const label = type === 'bugs' ? 'bugs' : 'weeds';
    await this.createInApp(victimUserId, 'attack_victim',
      `${emoji} @${attackerUsername} infested your crop!`,
      `Use ${type === 'bugs' ? 'Bug Spray' : 'Weed Kill'} to clear the ${label} before harvest.`);
  }

  async notifyQuestComplete(userId: string, questTitle: string, rewardGold: number, rewardEnergy: number): Promise<void> {
    const reward = `+${rewardGold}G${rewardEnergy > 0 ? ` +${rewardEnergy}⚡` : ''}`;
    await this.createInApp(userId, 'quest_complete',
      `✅ Quest done: ${questTitle}`,
      `Claim your reward: ${reward}`);
  }

  async notifyReferralBonus(referrerUserId: string, referrerTelegramId: number, newUsername: string, bonus: number, magnifiers = 1): Promise<void> {
    const magText = magnifiers > 0 ? ` and <b>+${magnifiers} Magnifying Glass${magnifiers > 1 ? 'es' : ''} 🔍</b>` : '';
    const text = `🎉 <b>@${newUsername}</b> joined Bandit Buddy via your invite!\n\nYou earned <b>+${bonus}G</b>${magText} referral bonus!`;
    await Promise.all([
      this.send(referrerTelegramId, text, '🥷 View Crew & Rewards', 'invite'),
      this.createInApp(referrerUserId, 'referral_joined',
        `🎉 @${newUsername} joined!`,
        `+${bonus}G${magnifiers > 0 ? ` and +${magnifiers} 🔍` : ''} added to your inventory.`),
    ]);
  }

  async notifyMasterKeyAwarded(referrerUserId: string, referrerTelegramId?: number, keys = 1): Promise<void> {
    const text = `🗝️💥 <b>MASTER KEY UNLOCKED!</b>\n\n3 of your recruited friends reached Player Level 3! You received <b>+${keys} Master Key 🗝️</b> to bypass guard dogs on any raid!`;
    const promises: Promise<any>[] = [
      this.createInApp(referrerUserId, 'master_key_unlocked',
        `🗝️ Master Key Unlocked!`,
        `+${keys} Master Key added to inventory (3 friends hit Lvl 3).`),
    ];
    if (referrerTelegramId) {
      promises.push(this.send(referrerTelegramId, text, '🗝️ View Inventory', 'storage'));
    }
    await Promise.all(promises);
  }

  async notifyHelpNeighbor(ownerUserId: string, helperUsername: string, actionType: 'bugs' | 'weeds' | 'water'): Promise<void> {
    const actionLabel = actionType === 'bugs' ? 'sprayed bugs on' : actionType === 'weeds' ? 'cleared weeds from' : 'watered';
    const emoji = actionType === 'bugs' ? '🐛' : actionType === 'weeds' ? '🌿' : '💧';
    await this.createInApp(ownerUserId, 'help_received',
      `🤝 @${helperUsername} helped your farm!`,
      `They ${emoji} ${actionLabel} your crop. Check your farm!`);
  }

  async notifyItemSold(
    sellerUserId: string,
    itemType: string,
    quantity: number,
    priceFormatted: string,
    buyerUsername?: string,
    sellerTelegramId?: number,
  ): Promise<void> {
    const formattedItem = itemType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const title = `💰 Item Sold!`;
    const body = `Your ${formattedItem}${quantity > 1 ? ` ×${quantity}` : ''} sold for ${priceFormatted}! Cha-ching!`;
    const promises: Promise<any>[] = [
      this.createInApp(sellerUserId, 'trade_filled', title, body, undefined, buyerUsername),
    ];
    if (sellerTelegramId) {
      const tgText =
        `💰 <b>MARKETPLACE SALE!</b>\n\n` +
        `Your <b>${formattedItem}${quantity > 1 ? ` ×${quantity}` : ''}</b> was purchased for <b>${priceFormatted}</b>!\n\n` +
        `Earnings were delivered directly to your wallet!`;
      promises.push(this.send(sellerTelegramId, tgText, '💰 View Market', 'market'));
    }
    await Promise.all(promises);
  }

  // ── Crons ─────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async notifyRipeHarvests(): Promise<void> {
    const now        = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Query ALL users with plots that just became ripe — no notifications_enabled filter
    const ripePlots = await this.plotRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.user', 'u')
      .where('p.harvestable_at <= :now', { now })
      .andWhere('p.harvestable_at > :ago', { ago: fiveMinAgo })
      .andWhere('p.seed_id IS NOT NULL')
      .getMany();

    const byUser = new Map<string, { user: User; count: number }>();
    for (const plot of ripePlots) {
      const user = (plot as any).user as User;
      if (!user) continue;
      const cur = byUser.get(plot.userId) ?? { user, count: 0 };
      byUser.set(plot.userId, { ...cur, count: cur.count + 1 });
    }

    for (const [userId, { user, count }] of byUser) {
      const plural = count > 1 ? 's' : '';
      const body   = `${count} plot${plural} just ripened. Harvest before thieves arrive!`;
      // Always create in-app notification
      void this.createInApp(userId, 'harvest_ready', `🌾 ${count} crop${plural} ready!`, body);
      // Telegram push only if user opted in
      if (user.notificationsEnabled && this.botToken) {
        void this.send(Number(user.telegramId),
          `🌾 Your crops are ready!\n\n<b>${count} plot${plural}</b> just ripened. Harvest now before someone steals them!`);
      }
    }
  }

  @Cron('0 9 * * *')
  async notifyDailyReward(): Promise<void> {
    const now       = new Date();
    const yesterday = new Date(now.getTime() - 20 * 60 * 60 * 1000);

    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.notifications_enabled = true')
      .andWhere('(u.last_daily_claim IS NULL OR u.last_daily_claim < :yesterday)', { yesterday })
      .select(['u.id', 'u.telegram_id', 'u.daily_streak'])
      .limit(500)
      .getRawMany();

    const REWARDS = [50, 75, 100, 150, 200, 300, 500];
    for (const u of users) {
      const streak  = u.u_daily_streak ?? 0;
      const nextDay = (streak % 7) + 1;
      const reward  = REWARDS[nextDay - 1];
      void Promise.all([
        this.send(Number(u.u_telegram_id),
          `🔥 Daily reward available!\n\nClaim your <b>Day ${nextDay}</b> reward: <b>${reward}G${nextDay === 7 ? ' + full energy 👑' : ''}</b>`),
        this.createInApp(u.u_id, 'daily_reminder',
          `🔥 Day ${nextDay} reward ready!`,
          `Claim ${reward}G${nextDay === 7 ? ' + full energy' : ''} before streak resets.`),
      ]);
    }
  }
}
