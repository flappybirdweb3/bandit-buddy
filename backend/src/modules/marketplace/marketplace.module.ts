import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { EventsGateway } from './events.gateway';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { ProcessedOnchainTx } from './entities/processed-onchain-tx.entity';
import { SystemConfig } from './entities/system-config.entity';
import { User } from '../user/entities/user.entity';
import { UserItem } from '../user/entities/user-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplaceListing, ProcessedOnchainTx, SystemConfig, User, UserItem])],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, EventsGateway],
  exports: [MarketplaceService, EventsGateway],
})
export class MarketplaceModule {}
