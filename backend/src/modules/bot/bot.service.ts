import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly botToken: string;
  private readonly botUsername: string;
  private readonly webhookSecret: string;
  private readonly appUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)     private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot) private readonly plotRepo: Repository<FarmPlot>,
  ) {
    this.botToken      = config.get<string>('telegram.botToken') ?? '';
    this.botUsername   = config.get<string>('telegram.botUsername') ?? 'BanditBuddyBot';
    this.webhookSecret = config.get<string>('telegram.webhookSecret') ?? '';
    this.appUrl        = config.get<string>('telegram.appUrl') ?? 'https://bandit.wvnd.vn';
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

    if (text.startsWith('/start')) {
      const param = text.split(' ')[1] ?? '';
      await this.handleStart(chatId, from, param);
    } else if (text === '/farm') {
      await this.handleFarm(chatId, from);
    } else if (text === '/status') {
      await this.handleStatus(chatId, from);
    } else if (text === '/help') {
      await this.handleHelp(chatId);
    }
  }

  private async handleStart(chatId: number, from: any, param: string): Promise<void> {
    const isRef = param.startsWith('ref_');
    const welcomeText = isRef
      ? `🦝 <b>Welcome to Bandit Buddy!</b>\n\nYou joined via a referral link — +120G bonus has been added to your farm!\n\n<i>Start planting and raiding your neighbors' crops.</i>`
      : `🦝 <b>Welcome to Bandit Buddy!</b>\n\nA play-to-earn farming game on Telegram.\n• 🌾 Plant crops and harvest gold\n• 🥷 Raid neighbors' farms\n• 🐕 Guard your farm with dogs\n• 💎 Claim $FARM tokens on BSC\n\nTap below to open your farm!`;

    await this.send(chatId, welcomeText);
  }

  private async handleFarm(chatId: number, from: any): Promise<void> {
    const user = await this.userRepo.findOne({ where: { telegramId: chatId } });
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
    const user = await this.userRepo.findOne({ where: { telegramId: chatId } });
    if (!user) {
      await this.send(chatId, '❌ No account found. Open the game first!');
      return;
    }

    await this.send(chatId,
      `📊 <b>Your Stats</b>\n\n💰 Gold: ${Math.floor(Number(user.goldBalance))}G\n⚡ Energy: ${user.energy}\n🔥 Streak: ${user.dailyStreak} days\n🎯 Trust: ${user.trustScore}\n🥷 Stolen: ${Math.floor(Number(user.goldStolen))}G`,
    );
  }

  private async handleHelp(chatId: number): Promise<void> {
    await this.send(chatId,
      `📖 <b>Bandit Buddy Commands</b>\n\n/start — Open the game\n/farm — Check your farm status\n/status — View your stats\n/help — Show this help\n\n<i>For full gameplay, open the mini app below.</i>`,
    );
  }

  async send(chatId: number, text: string): Promise<void> {
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
              url:  `https://t.me/${this.botUsername}?startapp=open`,
            }]],
          },
        }),
      });
    } catch (e) {
      this.logger.error(`[BotService] send failed: ${e}`);
    }
  }

  // Called from app startup to register webhook with Telegram
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
