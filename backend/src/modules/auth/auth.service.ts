import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RedisService } from '../../common/redis.service';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { LaunchConfigService } from '../user/launch-config.service';

const SESSION_TTL = 86400; // 24 h

@Injectable()
export class AuthService {
  private readonly userRepo: Repository<User>;
  private readonly plotRepo: Repository<FarmPlot>;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly launchConfig: LaunchConfigService,
    @InjectDataSource() dataSource: DataSource,
  ) {
    this.userRepo = dataSource.getRepository(User);
    this.plotRepo = dataSource.getRepository(FarmPlot);
  }

  async createSession(initData: string): Promise<{ token: string }> {
    const { telegramUser, startParam } = this.validateInitData(initData);
    if (!telegramUser) throw new UnauthorizedException('Invalid Telegram initData');

    let user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });
    const isNew = !user;

    if (!user) {
      try {
        user = await this.registerNewUser(telegramUser);
      } catch (err: any) {
        const isDuplicate = err?.code === '23505' || String(err?.message).includes('duplicate key');
        if (isDuplicate) user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });
        if (!user) throw err;
      }
    }

    if (isNew && startParam?.startsWith('ref_')) {
      const refTelegramId = parseInt(startParam.slice(4), 10);
      if (!isNaN(refTelegramId)) {
        await this.userService.applyReferral(user.id, refTelegramId).catch(() => {});
      }
    }

    const token = crypto.randomUUID();
    await this.redis.set(`sess:${token}`, user.id, SESSION_TTL);
    return { token };
  }

  async resolveBearer(token: string): Promise<User | null> {
    const userId = await this.redis.get(`sess:${token}`);
    if (!userId) return null;
    // Refresh TTL on use so active players stay logged in
    await this.redis.set(`sess:${token}`, userId, SESSION_TTL);
    return this.userRepo.findOne({ where: { id: userId } }) ?? null;
  }

  private validateInitData(initData: string): { telegramUser: any; startParam: string | null } {
    const botToken = this.config.get<string>('telegram.botToken');
    const empty = { telegramUser: null, startParam: null };

    // FAIL CLOSED — same policy as TelegramAuthGuard.validateInitData().
    // The old isDev branch let callers pick any telegram_id when the bot token was
    // absent. POST /auth/session is a public endpoint, so that bypass was reachable
    // without any prior authentication. Removing it means a misconfigured deployment
    // returns 401 rather than silently handing out sessions to anyone.
    if (!botToken || botToken === 'your_telegram_bot_token_here') {
      return empty;
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

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      if (computedHash !== hash) return empty;

      const userParam = params.get('user');
      return { telegramUser: userParam ? JSON.parse(userParam) : null, startParam: params.get('start_param') };
    } catch { return empty; }
  }

  private async registerNewUser(telegramUser: any): Promise<User> {
    const startingGold = this.launchConfig.getNewUserStartingGold();
    const user = this.userRepo.create({
      telegramId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name,
      goldBalance: startingGold,
      energy: 100,
      trustScore: 50,
      nonce: 0,
    });
    const savedUser = await this.userRepo.save(user);

    const initialPlots = Array.from({ length: 6 }, (_, i) =>
      this.plotRepo.create({ userId: savedUser.id, plotIndex: i }),
    );
    await this.plotRepo.save(initialPlots);

    // Initial Seeding: Gift starting magnifying glass if configured
    const startingMagnifiers = this.launchConfig.getNewUserStartingMagnifier();
    if (startingMagnifiers > 0) {
      await this.userService.grantItem(savedUser.id, 'magnifying_glass', startingMagnifiers).catch(() => {});
    }

    return savedUser;
  }
}
