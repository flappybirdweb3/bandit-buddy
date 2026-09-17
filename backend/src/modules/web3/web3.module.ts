import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Web3Controller } from './web3.controller';
import { Web3Service } from './web3.service';
import { DexOracleService } from './dex-oracle.service';
import { DexVolumeService } from './dex-volume.service';
import { EconomyOracleService } from './economy-oracle.service';
import { FusionOracleService } from './fusion-oracle.service';
import { TreasuryMonitorService } from './treasury-monitor.service';
import { Web3AdminController } from './web3-admin.controller';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { ClaimIntent } from './entities/claim-intent.entity';
import { GoldTransaction } from './entities/gold-transaction.entity';
import { Subscription } from '../guild/entities/subscription.entity';
import { GuildModule } from '../guild/guild.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, NftGuardDog, ClaimIntent, GoldTransaction, Subscription]),
    CommonModule,
    forwardRef(() => GuildModule),
  ],
  controllers: [Web3Controller, Web3AdminController],
  providers: [
    Web3Service,
    DexOracleService,
    DexVolumeService,
    EconomyOracleService,
    FusionOracleService,
    TreasuryMonitorService,
  ],
  exports: [
    Web3Service,
    DexOracleService,
    DexVolumeService,
    EconomyOracleService,
    FusionOracleService,
    TreasuryMonitorService,
  ],
})
export class Web3Module {}

