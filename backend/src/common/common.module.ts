import { Global, Module } from '@nestjs/common';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';

@Global()
@Module({
  providers: [TelegramAuthGuard],
  exports: [TelegramAuthGuard],
})
export class CommonModule {}
