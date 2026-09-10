import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShopItem, User, NftGuardDog])],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
