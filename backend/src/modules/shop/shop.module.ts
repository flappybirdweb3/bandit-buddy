import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { GuildModule } from '../guild/guild.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopItem, User, NftGuardDog]),
    forwardRef(() => GuildModule),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
