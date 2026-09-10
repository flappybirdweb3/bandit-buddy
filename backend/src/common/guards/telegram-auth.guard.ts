import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../modules/user/entities/user.entity';
import { FarmPlot } from '../../modules/farm/entities/farm-plot.entity';
import { NotificationService } from '../../modules/notification/notification.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly userRepo: Repository<User>;
  private readonly plotRepo: Repository<FarmPlot>;

  constructor(
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
    @InjectDataSource()
    dataSource: DataSource,
  ) {
    this.userRepo = dataSource.getRepository(User);
    this.plotRepo = dataSource.getRepository(FarmPlot);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const initData = request.headers['x-telegram-init-data'];

    if (!initData) throw new UnauthorizedException('Missing Telegram initData');

    const { telegramUser, startParam } = this.validateInitData(initData);
    if (!telegramUser) throw new UnauthorizedException('Invalid Telegram initData signature');

    let user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });
    const isNew = !user;

    if (!user) {
      user = await this.registerNewUser(telegramUser);
    }

    // Apply referral bonus on first login if came via invite link
    if (isNew && startParam?.startsWith('ref_')) {
      const refTelegramId = parseInt(startParam.slice(4), 10);
      if (!isNaN(refTelegramId)) {
        await this.applyReferral(user.id, refTelegramId, telegramUser.username ?? telegramUser.first_name ?? 'Someone');
      }
    }

    request.user = user;
    return true;
  }

  private validateInitData(initData: string): { telegramUser: any; startParam: string | null } {
    const botToken = this.config.get<string>('telegram.botToken');
    const empty = { telegramUser: null, startParam: null };

    // Dev mode: skip HMAC ONLY when no real bot token is configured
    // Never bypass on NODE_ENV — that would expose production to devuser spoofing
    const isDev = !botToken || botToken === 'your_telegram_bot_token_here';
    if (isDev) {
      try {
        const params = new URLSearchParams(initData);
        const userParam = params.get('user');
        return {
          telegramUser: userParam ? JSON.parse(userParam) : null,
          startParam: params.get('start_param'),
        };
      } catch {
        return empty;
      }
    }

    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return empty;

      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (computedHash !== hash) return empty;

      const userParam = params.get('user');
      return {
        telegramUser: userParam ? JSON.parse(userParam) : null,
        startParam: params.get('start_param'),
      };
    } catch {
      return empty;
    }
  }

  private async applyReferral(newUserId: string, referrerTelegramId: number, newUsername: string): Promise<void> {
    const referrer = await this.userRepo.findOne({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === newUserId) return;
    // Both parties get 120G: referrer as reward, new user as welcome bonus
    await Promise.all([
      this.userRepo.update(newUserId, { referredBy: referrer.id }),
      this.userRepo.increment({ id: newUserId }, 'goldBalance', 120),
      this.userRepo.increment({ id: referrer.id }, 'goldBalance', 120),
    ]);
    if (referrer.notificationsEnabled) {
      this.notificationService.notifyReferralBonus(
        referrer.id, Number(referrer.telegramId), newUsername, 120,
      ).catch(() => {});
    }
  }

  private async registerNewUser(telegramUser: any): Promise<User> {
    const user = this.userRepo.create({
      telegramId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name,
      goldBalance: 250, // Starter gold — enough for 2 Turnips (120G each)
      energy: 100,
      trustScore: 50,
      nonce: 0,
    });

    const savedUser = await this.userRepo.save(user);

    // Provision 6 initial farm plots
    const initialPlots = Array.from({ length: 6 }, (_, i) =>
      this.plotRepo.create({ userId: savedUser.id, plotIndex: i }),
    );
    await this.plotRepo.save(initialPlots);

    return savedUser;
  }
}
