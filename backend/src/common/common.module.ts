import { Global, Module } from '@nestjs/common';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { NotificationModule } from '../modules/notification/notification.module';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [TelegramAuthGuard],
  exports: [TelegramAuthGuard],
})
export class CommonModule {}
