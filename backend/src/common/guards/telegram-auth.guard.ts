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

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly userRepo: Repository<User>;
  private readonly plotRepo: Repository<FarmPlot>;

  constructor(
    private readonly config: ConfigService,
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

    const telegramUser = this.validateInitData(initData);
    if (!telegramUser) throw new UnauthorizedException('Invalid Telegram initData signature');

    let user = await this.userRepo.findOne({ where: { telegramId: telegramUser.id } });

    if (!user) {
      user = await this.registerNewUser(telegramUser);
    }

    request.user = user;
    return true;
  }

  private validateInitData(initData: string): any {
    const botToken = this.config.get<string>('telegram.botToken');

    // Dev mode: skip HMAC and parse user directly
    const isDev = !botToken
      || botToken === 'your_telegram_bot_token_here'
      || process.env.NODE_ENV === 'development';
    if (isDev) {
      try {
        const params = new URLSearchParams(initData);
        const userParam = params.get('user');
        return userParam ? JSON.parse(userParam) : null;
      } catch {
        return null;
      }
    }

    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return null;

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

      if (computedHash !== hash) return null;

      const userParam = params.get('user');
      return userParam ? JSON.parse(userParam) : null;
    } catch {
      return null;
    }
  }

  private async registerNewUser(telegramUser: any): Promise<User> {
    const user = this.userRepo.create({
      telegramId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name,
      goldBalance: 50, // Starter gold
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
