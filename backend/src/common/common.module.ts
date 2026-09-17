import { Global, Module } from '@nestjs/common';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { NotificationModule } from '../modules/notification/notification.module';
import { RedisService } from './redis.service';
import { AntiCheatService } from './anti-cheat.service';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [TelegramAuthGuard, RedisService, AntiCheatService],
  exports: [TelegramAuthGuard, RedisService, AntiCheatService],
})
export class CommonModule {}
