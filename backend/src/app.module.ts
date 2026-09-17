import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { FarmModule } from './modules/farm/farm.module';
import { ActionModule } from './modules/action/action.module';
import { Web3Module } from './modules/web3/web3.module';
import { NotificationModule } from './modules/notification/notification.module';
import { QuestModule } from './modules/quest/quest.module';
import { ShopModule } from './modules/shop/shop.module';
import { BotModule } from './modules/bot/bot.module';
import { GuildModule } from './modules/guild/guild.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Try both: project root (when running compiled from barnbuddy/) and parent (dev from backend/)
      envFilePath: ['.env', '../.env'],
    }),

    // Rate limiting: default 100 req/min globally; steal endpoint overrides to 3/sec
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'steal',
        ttl: 1000,
        limit: 3,
      },
    ]),

    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    UserModule,
    FarmModule,
    ActionModule,
    Web3Module,
    NotificationModule,
    QuestModule,
    ShopModule,
    BotModule,
    GuildModule,
    MarketplaceModule,
    InventoryModule,
    AuthModule,
  ],
  providers: [
    // Global rate limiting.
    // ThrottlerModule.forRoot() configures the budgets; this makes ThrottlerGuard
    // enforce them on every route. Without APP_GUARD the @Throttle() decorators set
    // metadata but no guard runs — rate limiting is silently disabled.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
