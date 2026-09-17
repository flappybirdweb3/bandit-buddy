import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../modules/user/entities/user.entity';
import { FarmPlot } from '../../modules/farm/entities/farm-plot.entity';
import { NotificationService } from '../../modules/notification/notification.service';
import { AuthService } from '../../modules/auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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
    private readonly dataSource: DataSource,
    private readonly reflector?: Reflector,
  ) {
    this.userRepo = dataSource.getRepository(User);
    this.plotRepo = dataSource.getRepository(FarmPlot);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();

    const rawCookie: string = request.headers['cookie'] ?? '';
    const cookieToken = rawCookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('bb_sess='))
      ?.slice('bb_sess='.length) || undefined;

    const authHeader: string = request.headers['authorization'] ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    // Standard header containing cryptographic proof from Telegram
    const initData = ((request.headers['x-telegram-init-data'] as string | undefined) ?? '').trim();

    // 1. PRIMARY: x-telegram-init-data header.
    // If present, it is the authoritative, signed credential for the active Telegram account
    // in this specific window/iframe. It MUST take precedence over any shared or leftover
    // browser cookies on multi-account machines.
    if (initData) {
      const { telegramUser, startParam } = this.validateInitData(initData);
      if (!telegramUser) {
        this.logger.warn(`Auth failed: invalid initData signature. prefix: ${initData.slice(0, 80)}`);
        throw new UnauthorizedException('Invalid Telegram initData signature');
      }

      // Fast-path: if session cookie or bearer token exists and matches THIS user's telegramId,
      // reuse cached session user from Redis (bypasses DB write/read).
      const activeToken = cookieToken || bearerToken;
      if (activeToken) {
        try {
          const cachedUser = await this.authService.resolveBearer(activeToken);
          if (cachedUser && Number(cachedUser.telegramId) === telegramUser.id) {
            request.user = cachedUser;
            return true;
          }
        } catch (err) {
          this.logger.warn(`Session cache check failed: ${(err as Error).message}`);
        }
      }

      // Cookie missing, expired, or belongs to a different account on this machine:
      // Resolve/upsert the cryptographically verified user.
      const { user, isNew } = await this.upsertTelegramUser(telegramUser);

      if (isNew && startParam?.startsWith('ref_')) {
        const refTelegramId = parseInt(startParam.slice(4), 10);
        if (!isNaN(refTelegramId)) {
          try {
            await this.applyReferral(
              user.id,
              refTelegramId,
              telegramUser.username ?? telegramUser.first_name ?? 'Someone',
            );
          } catch (err) {
            this.logger.warn(
              `Referral bonus failed for user ${user.id} (login continues): ${(err as Error).message}`,
            );
          }
        }
      }

      request.user = user;
      return true;
    }

    // 2. SECONDARY FALLBACK: bb_sess cookie (for clients that do not send custom headers)
    if (cookieToken) {
      try {
        const user = await this.authService.resolveBearer(cookieToken);
        if (user) { request.user = user; return true; }
      } catch (err) {
        this.logger.warn(
          `Session cookie lookup failed: ${(err as Error).message}`,
        );
      }
    }

    // 3. TERTIARY FALLBACK: Authorization: Bearer <session-uuid>
    if (bearerToken) {
      try {
        const user = await this.authService.resolveBearer(bearerToken);
        if (user) { request.user = user; return true; }
      } catch (err) {
        this.logger.warn(`Bearer session lookup failed: ${(err as Error).message}`);
      }
    }

    throw new UnauthorizedException('Missing Telegram initData');
  }

  private validateInitData(initData: string): { telegramUser: any; startParam: string | null } {
    const botToken = this.config.get<string>('telegram.botToken');
    const empty = { telegramUser: null, startParam: null };

    // FAIL CLOSED. There is no dev bypass and no NODE_ENV bypass any more.
    //
    // The old `isDev` branch parsed `user` straight out of initData WITHOUT verifying the
    // HMAC whenever the bot token was missing or still the placeholder. Anything that
    // reached the guard could then choose its own telegram_id, and each such request
    // resolved or created a different account. Without a token we cannot verify anything,
    // so the only safe answer is "not authenticated".
    if (!botToken || botToken === 'your_telegram_bot_token_here') {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN is not configured — rejecting every request. Identity cannot ' +
          'be verified without it (there is no unauthenticated fallback, by design).',
      );
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

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest();

      // Constant-time compare: `!==` on hex strings leaks how many leading characters
      // matched. The length guard is required because timingSafeEqual THROWS on
      // mismatched buffer lengths — a malformed `hash=` would otherwise be a 500.
      const providedHash = Buffer.from(hash, 'hex');
      if (
        providedHash.length !== computedHash.length ||
        !crypto.timingSafeEqual(providedHash, computedHash)
      ) {
        return empty;
      }

      const userParam = params.get('user');
      if (!userParam) return empty;

      let telegramUser: { id?: unknown; username?: string; first_name?: string };
      try {
        telegramUser = JSON.parse(userParam);
      } catch {
        return empty;
      }

      // The id must be a real number from the VERIFIED payload. `undefined` would key a
      // new row on nothing and hand every client the same "user".
      if (!telegramUser || typeof telegramUser.id !== 'number' || !Number.isFinite(telegramUser.id)) {
        return empty;
      }

      // Telegram recommends rejecting stale payloads: a leaked initData string stays
      // replayable for as long as we keep accepting it. `auth_date` is inside the signed
      // payload, so it cannot be forged. Only the handshake is affected — afterwards the
      // session travels in bb_sess / Bearer.
      const maxAgeSec = this.config.get<number>('telegram.initDataMaxAgeSec') ?? (86_400 * 90);
      const authDate = Number(params.get('auth_date'));
      if (!Number.isFinite(authDate) || authDate <= 0) {
        this.logger.warn('Rejected initData without a usable auth_date');
        return empty;
      }
      const ageSec = Math.floor(Date.now() / 1000) - authDate;
      if (ageSec < -300) {
        this.logger.warn(`Rejected initData from future (clock skew: ${ageSec}s)`);
        return empty;
      }
      if (ageSec > maxAgeSec) {
        this.logger.warn(`Rejected stale initData (age ${ageSec}s > ${maxAgeSec}s)`);
        return empty;
      }

      return {
        telegramUser,
        startParam: params.get('start_param'),
      };
    } catch {
      return empty;
    }
  }

  private async applyReferral(newUserId: string, referrerTelegramId: number, newUsername: string): Promise<void> {
    const referrer = await this.userRepo.findOne({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === newUserId) return;
    // Both parties get 120G: referrer as reward, new user as welcome bonus. Referrer gets +1 Magnifying Glass.
    await Promise.all([
      this.userRepo.update(newUserId, { referredBy: referrer.id }),
      this.userRepo.increment({ id: newUserId }, 'goldBalance', 120),
      this.userRepo.increment({ id: referrer.id }, 'goldBalance', 120),
      // PVP-03: Grant 1 Magnifying Glass to referrer
      this.dataSource.query(
        `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
         VALUES ($1, 'magnifying_glass', 1, 0)
         ON CONFLICT (user_id, item_type)
         DO UPDATE SET quantity = user_items.quantity + 1`,
        [referrer.id],
      ),
      // Record referral reward milestone
      this.dataSource.query(
        `INSERT INTO referral_rewards (referrer_id, reward_type, referred_user_id, milestone_count)
         VALUES ($1, 'magnifying_glass', $2, 1)`,
        [referrer.id, newUserId],
      ).catch(() => {}),
    ]);
    if (referrer.notificationsEnabled) {
      this.notificationService.notifyReferralBonus(
        referrer.id, Number(referrer.telegramId), newUsername, 120, 1,
      ).catch(() => {});
    }
  }

  /**
   * Resolve — or create — the single `users` row for this Telegram account.
   *
   * ONE atomic statement keyed on the UNIQUE index on users.telegram_id. The previous
   * "findOne, then save if absent" was check-then-act: two logins could both observe no
   * row and both insert, and the loser's 23505 was swallowed by a catch that then re-read
   * whichever row won — leaving two accounts that the same human experiences as one.
   *
   * `ON CONFLICT DO NOTHING … RETURNING id` yields a row only when THIS call performed the
   * insert, which is exactly what distinguishes a first login from a returning device.
   *
   * Plots are provisioned only on a real insert, and with ON CONFLICT DO NOTHING so the
   * parallel-first-load case (GameProvider fires /user/profile and /farm/my together)
   * cannot 23505; FarmService.ensureInitialPlots() backfills anything still missing on a
   * half-provisioned account.
   */
  private async upsertTelegramUser(
    telegramUser: { id: number; username?: string; first_name?: string },
  ): Promise<{ user: User; isNew: boolean }> {
    // `string | undefined`, NOT `| null`: the insert's value type is
    // `string | (() => string) | undefined`, so passing `null` was a hard TS2322 that made
    // `nest build` — and therefore `npm run test:e2e` — fail outright. A failing build is
    // how the two gold symptoms below could be observed while this file looked correct:
    // the process serving traffic was an older artefact.
    const username = telegramUser.username || telegramUser.first_name || undefined;

    // Starter resources come from configuration and are written in the SAME insert that
    // creates the row. The schema default for users.gold_balance is 0, so any creation
    // path that omits this column yields an account that cannot afford a single seed.
    const startingGold   = this.config.get<number>('game.startingGold') ?? 250;
    const startingEnergy = this.config.get<number>('game.initialEnergy') ?? 100;

    return this.dataSource.transaction(async (manager) => {
      const insert = await manager
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          telegramId: telegramUser.id,
          username,
          goldBalance: startingGold,
          energy: startingEnergy,
          trustScore: 50,
          nonce: 0,
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      const isNew = Array.isArray(insert.raw) && insert.raw.length > 0;

      // Returning device: read the canonical row back, looked up by telegram_id — never by
      // anything the client supplied, so this cannot be pointed at another account.
      const userId: string | undefined = isNew
        ? (insert.raw[0] as { id: string }).id
        : (
            await manager.findOne(User, {
              where: { telegramId: telegramUser.id },
              select: ['id'],
            })
          )?.id;

      if (!userId) {
        throw new Error(`users row for telegram_id ${telegramUser.id} missing after upsert`);
      }

      if (isNew) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(FarmPlot)
          .values(Array.from({ length: 6 }, (_, i) => ({ userId, plotIndex: i })))
          .orIgnore()
          .execute();
      }

      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new Error(`users row ${userId} not found after upsert`);

      return { user, isNew };
    });
  }
}
