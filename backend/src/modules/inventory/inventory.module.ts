import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { UserItem } from '../user/entities/user-item.entity';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { GuildModule } from '../guild/guild.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserItem, User, NftGuardDog]),
    GuildModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
