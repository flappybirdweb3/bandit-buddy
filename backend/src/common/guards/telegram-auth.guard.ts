import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../modules/user/entities/user.entity';
import { FarmPlot } from '../../modules/farm/entities/farm-plot.entity';
import { NotificationService } from '../../modules/notification/notification.service';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);
  private readonly userRepo: Repository<User>;
  private readonly plotRepo: Repository<FarmPlot>;

  constructor(
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    @InjectDataSource()
    dataSource: DataSource,
  ) {
    this.userRepo = dataSource.getRepository(User);
    this.plotRepo = dataSource.getRepository(FarmPlot);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Primary: bb_sess cookie — set by GET/POST /auth/session.
    // Cookie is sent automatically by the browser for same-origin requests,
    // requires NO custom headers, and passes through any proxy transparently.
    const rawCookie: string = request.headers['cookie'] ?? '';
    const cookieToken = rawCookie.split('; ')
      .find((c: string) => c.startsWith('bb_sess='))
      ?.slice('bb_sess='.length);
    if (cookieToken) {
      const user = await this.authService.resolveBearer(cookieToken);
      if (user) { request.user = user; return true; }
      // Cookie is stale — fall through to initData validation
    }

    // Secondary: Authorization: Bearer <session-uuid> (legacy header-based flow)
    const authHeader: string = request.headers['authorization'] ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const user = await this.authService.resolveBearer(token);
      if (!user) throw new UnauthorizedException('Session expired — please reload');
      request.user = user;
      return true;
    }

    // Legacy fallbacks for clients that still send initData directly in headers
    const b64Header = request.headers['x-tg-init'] as string | undefined;
    let initData: string;
    if (b64Header) {
      try {
        initData = Buffer.from(b64Header, 'base64').toString('utf8');
      } catch { initData = ''; }
    } else {
      initData = authHeader.startsWith('tg ') ? authHeader.slice(3)
        : (request.headers['x-telegram-init-data'] as string ?? '');
    }

    if (!initData) throw new UnauthorizedException('Missing Telegram initData');

    const { telegramUser, startParam } = this.validateInitData(initData);
    if (!telegramUser) {
      this.logger.warn(`Auth failed: invalid signature. initData prefix: ${String(initData).slice(0, 80)}`);
      throw new UnauthorizedException('Invalid Telegram initData signature');
    }

    let user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });
    const isNew = !user;

    if (!user) {
      // Use upsert to handle race condition when two requests arrive simultaneously for the same new user.
      // Both getProfile and getMyFarm fire in parallel on first load — without upsert, both try INSERT → unique constraint on telegramId.
      try {
        user = await this.registerNewUser(telegramUser);
      } catch (err: any) {
        // Handle unique constraint violation from concurrent first-login requests
        const isDuplicate = err?.code === '23505' || String(err?.message).includes('duplicate key');
        if (isDuplicate) {
          user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });
        }
        if (!user) throw err;
      }
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
