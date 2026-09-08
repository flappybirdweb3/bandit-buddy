import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { FarmModule } from './modules/farm/farm.module';
import { ActionModule } from './modules/action/action.module';
import { Web3Module } from './modules/web3/web3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '../.env',
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

    DatabaseModule,
    CommonModule,
    UserModule,
    FarmModule,
    ActionModule,
    Web3Module,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
