import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { GuildService } from '../guild/guild.service';
import { Guild } from '../guild/entities/guild.entity';
import { GuildMember } from '../guild/entities/guild-member.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly botToken: string;
  private readonly botUsername: string;
  private readonly webhookSecret: string;
  private readonly appUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)        private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)    private readonly plotRepo: Repository<FarmPlot>,
    private readonly guildService: GuildService,
    private readonly userService: UserService,
  ) {
    this.botToken      = config.get<string>('telegram.botToken') ?? '';
    this.botUsername   = config.get<string>('telegram.botUsername') ?? 'BanditBuddyBot';
    this.webhookSecret = config.get<string>('telegram.webhookSecret') ?? '';
    this.appUrl        = config.get<string>('telegram.appUrl') ?? 'https://banditbuddy.xyz';
  }

  async handleUpdate(update: any, secret: string): Promise<void> {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      this.logger.warn('Webhook secret mismatch — ignoring update');
      return;
    }

    const msg = update?.message;
    if (!msg) return;

    const chatId = msg.chat?.id as number;
    const text   = (msg.text ?? '') as string;
    const from   = msg.from;

    if (!chatId) return;

    // Handle new users joining group
    if (msg.new_chat_members && Array.isArray(msg.new_chat_members)) {
      await this.handleNewChatMembers(chatId, msg.new_chat_members);
    }

    const parts = text.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase().split('@')[0];
    const param = parts.slice(1).join(' ');

    if (command === '/start') {
      await this.handleStart(chatId, from, param);
    } else if (command === '/farm') {
      await this.handleFarm(chatId, from);
    } else if (command === '/status') {
      await this.handleStatus(chatId, from);
    } else if (command === '/water') {
      await this.handleWater(chatId, from, msg.chat);
    } else if (command === '/tree' || command === '/guild') {
      await this.handleTree(chatId, from, msg.chat);
    } else if (command === '/link_guild') {
      await this.handleLinkGuild(chatId, from, msg.chat, param);
    } else if (command === '/help') {
      await this.handleHelp(chatId);
    }
  }

  private async handleStart(chatId: number, from: any, param: string): Promise<void> {
    const isRef = param.startsWith('ref_');
    if (isRef && from?.id) {
      const refTgId = parseInt(param.replace('ref_', ''), 10);
      if (!isNaN(refTgId)) {
        const user = await this.userRepo.findOne({ where: { telegramId: from.id } });
        if (user && !user.referredBy) {
          await this.userService.applyReferral(user.id, refTgId).catch(() => {});
        }
      }
    }

    const welcomeText = isRef
      ? `🦝 <b>Welcome to Bandit Buddy!</b>\n\nYou joined via a referral link — +120G bonus has been added to your farm!\n\n<i>Start planting and watering your Guild World Tree with friends!</i>`
      : `🦝 <b>Welcome to Bandit Buddy!</b>\n\nA play-to-earn Social-Fi farming game on Telegram.\n• 🌾 Plant crops and harvest gold\n• 🌳 Co-op Guild World Tree with your group\n• 🥷 Raid neighbors' farms & Guild Wars\n• 🐕 Guard your farm with dogs\n• 💎 Claim $FARM tokens on BSC\n\nTap below to open your farm!`;

    await this.send(chatId, welcomeText, isRef ? param : 'open');
  }

  private async handleFarm(chatId: number, from: any): Promise<void> {
    const fromId = from?.id || chatId;
    const user = await this.userRepo.findOne({ where: { telegramId: fromId } });
    if (!user) {
      await this.send(chatId, '🦝 No farm found. Open the game to create yours!');
      return;
    }

    const plots = await this.plotRepo.find({ where: { userId: user.id }, relations: ['seed'] });
    const ripe     = plots.filter(p => p.harvestableAt && new Date(p.harvestableAt) <= new Date()).length;
    const growing  = plots.filter(p => p.seedId && !(p.harvestableAt && new Date(p.harvestableAt) <= new Date())).length;
    const empty    = plots.filter(p => !p.seedId).length;

    const status = ripe > 0 ? `🟢 ${ripe} crop${ripe > 1 ? 's' : ''} ready to harvest!` : '🟡 No crops ready yet';
    await this.send(chatId,
      `🌾 <b>Your Farm (@${user.username})</b>\n\n${status}\n\n• 🌱 Growing: ${growing}\n• 📦 Empty: ${empty}\n• 💰 Gold: ${Math.floor(Number(user.goldBalance))}G\n• ⚡ Energy: ${user.energy}`,
    );
  }

  private async handleStatus(chatId: number, from: any): Promise<void> {
    const fromId = from?.id || chatId;
    const user = await this.userRepo.findOne({ where: { telegramId: fromId } });
    if (!user) {
      await this.send(chatId, '❌ No account found. Open the game first!');
      return;
    }

    await this.send(chatId,
      `📊 <b>Your Stats</b>\n\n💰 Gold: ${Math.floor(Number(user.goldBalance))}G\n⚡ Energy: ${user.energy}\n🔥 Streak: ${user.dailyStreak} days\n🎯 Trust: ${user.trustScore}\n🥷 Stolen: ${Math.floor(Number(user.goldStolen))}G`,
    );
  }

  // ── World Tree Telegram Social-Fi commands ─────────────────────────────

  private async handleWater(chatId: number, from: any, chat: any): Promise<void> {
    const fromId = from?.id;
    if (!fromId) return;

    const user = await this.userRepo.findOne({ where: { telegramId: fromId } });
    if (!user) {
      await this.send(chatId, `🦝 @${from.username || 'Friend'}, please open the game first to start your farm!`);
      return;
    }

    try {
      const isGroup = chat?.type === 'group' || chat?.type === 'supergroup';
      let targetGuildId: string | undefined = undefined;
      if (isGroup) {
        const linkedGuild = await this.guildService.getGuildByTelegramGroup(String(chatId));
        if (linkedGuild) {
          targetGuildId = linkedGuild.id;
        }
      }
      const res = await this.guildService.waterTree(user.id, targetGuildId);

      const reply = `💧 <b>GUILD WORLD TREE</b>\n\n` +
        `👤 <b>@${from.username || user.username}</b> just watered the tree!\n` +
        `🌱 Growth Progress: <b>${res.treeProgressPercent}%</b> (+${res.progressAdded}%)\n` +
        `🌳 World Tree: <b>Level ${res.treeLevel}</b>\n` +
        `⭐ Your Contribution: <b>${res.myPoints} pts</b>\n\n` +
        (res.isRipe
          ? `🎉 <b>TREE IS 100% RIPE!</b> The $FARM reward chest is open! Open the game to claim your rewards!`
          : `💡 <i>Social-Fi Tip: Invite new friends to this group for a +5% growth boost on their first water!</i>`);

      await this.send(chatId, reply);
    } catch (err: any) {
      await this.send(chatId, `⚠️ ${err.message}`);
    }
  }

  private async handleTree(chatId: number, from: any, chat: any): Promise<void> {
    const fromId = from?.id;
    if (!fromId) return;

    const user = await this.userRepo.findOne({ where: { telegramId: fromId } });
    if (!user) {
      await this.send(chatId, `🦝 Open the game below to register!`);
      return;
    }

    const isGroup = chat?.type === 'group' || chat?.type === 'supergroup';
    let guildInfo = await this.guildService.getMyGuild(user.id);
    if (isGroup && !guildInfo) {
      guildInfo = await this.guildService.getGuildByTelegramGroup(String(chatId), user.id);
    }

    if (!guildInfo) {
      await this.send(chatId, isGroup
        ? `🏰 This group is not linked to any guild yet! Guild owners can type <code>/link_guild [Guild Name]</code> to link.`
        : `🏰 You are not in a guild yet. Open the game to create or join a guild!`
      );
      return;
    }

    const badge = guildInfo.isPremium ? '⭐ [BLUE BADGE ELITE]' : '🏰 [FREE TIER]';
    const statusText = guildInfo.status === 'ripe' ? '🎉 RIPE (100% - Ready to claim)' : `🌱 Growing (${guildInfo.treeProgressPercent}%)`;
    const shieldText = guildInfo.isShielded
      ? `🛡️ Energy Shield active (${guildInfo.shieldRemainingHours}h remaining)`
      : '⚠️ No shield (Vulnerable to GvG raid)';

    const text = `🌳 <b>WORLD TREE — ${guildInfo.name}</b>\n\n` +
      `🎖️ Guild: ${badge}\n` +
      `🌲 Tree Level: Level ${guildInfo.treeLevel} / ${guildInfo.maxMembers > 20 ? '10' : '3'}\n` +
      `📊 Progress: <b>${guildInfo.treeProgressPercent}%</b>\n` +
      `🌿 Status: ${statusText}\n` +
      `🛡️ Defense: ${shieldText}\n` +
      `💰 Reward Pool: <b>${guildInfo.rewardPoolFarm} $FARM + ${guildInfo.rewardPoolGold} Gold</b>\n\n` +
      `👥 Members: ${guildInfo.memberCount}/${guildInfo.maxMembers}\n` +
      `🎯 Your Contribution: <b>${guildInfo.myContribution?.calculatedPoints ?? 0} pts</b> (${guildInfo.myContribution?.sharePercent ?? 0}% share)\n\n` +
      `Type <b>/water</b> to water the tree today!`;

    await this.send(chatId, text);
  }

  private async handleLinkGuild(chatId: number, from: any, chat: any, guildNameOrId: string): Promise<void> {
    const fromId = from?.id;
    if (!fromId) return;

    const user = await this.userRepo.findOne({ where: { telegramId: fromId } });
    if (!user) {
      await this.send(chatId, `❌ Please open the game first!`);
      return;
    }

    try {
      const res = await this.guildService.linkTelegramGroup(user.id, String(chatId), guildNameOrId || undefined);
      await this.send(chatId, `✅ ${res.message}\n\nGroup members can now type <b>/water</b> to grow the World Tree!`);
    } catch (err: any) {
      await this.send(chatId, `❌ ${err.message}`);
    }
  }

  private async handleNewChatMembers(chatId: number, members: any[]): Promise<void> {
    const linkedGuild = await this.guildService.getGuildByTelegramGroup(String(chatId));
    const guildName = linkedGuild ? linkedGuild.name : 'the Guild';
    for (const m of members) {
      if (m.is_bot) continue;
      const memberName = m.username ? `@${m.username}` : (m.first_name || 'Friend');
      await this.send(chatId,
        `🌱 <b>Welcome ${memberName} to ${guildName}!</b>\n\n` +
        `Type <b>/water</b> now to nurture the Guild World Tree and earn cycle rewards together! (First water gives <b>+5% Viral Boost</b>!)`,
      );
    }
  }

  private async handleHelp(chatId: number): Promise<void> {
    await this.send(chatId,
      `📖 <b>Bandit Buddy Commands</b>\n\n` +
      `/start — Open the game\n` +
      `/water — Water Guild World Tree (+1% / +5% Viral)\n` +
      `/tree — Check your Guild World Tree status\n` +
      `/farm — Check your farm crops\n` +
      `/status — View your stats\n` +
      `/link_guild [name] — Link group with Guild\n` +
      `/help — Show this help message`,
    );
  }

  async send(chatId: number, text: string, startParam: string = 'open'): Promise<void> {
    if (!this.botToken || this.botToken === 'your_telegram_bot_token_here') {
      this.logger.warn('[BotService] BOT_TOKEN not set');
      return;
    }
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{
              text: '🥷 Open Bandit Buddy',
              url:  `https://t.me/${this.botUsername}?startapp=${startParam}`,
            }]],
          },
        }),
      });
    } catch (e) {
      this.logger.error(`[BotService] send failed: ${e}`);
    }
  }

  async registerWebhook(webhookUrl: string): Promise<void> {
    if (!this.botToken || this.botToken === 'your_telegram_bot_token_here') return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:          webhookUrl,
          secret_token: this.webhookSecret || undefined,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      const data = await res.json() as any;
      this.logger.log(`[BotService] setWebhook: ${JSON.stringify(data)}`);
    } catch (e) {
      this.logger.error(`[BotService] registerWebhook failed: ${e}`);
    }
  }
}
