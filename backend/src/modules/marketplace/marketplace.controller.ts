import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, Query,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CreateListingDto } from './dto/marketplace.dto';

@Controller('marketplace')
@UseGuards(TelegramAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('list')
  async createListing(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.marketplaceService.createListing(user.id, dto);
  }

  @Get('listings')
  async getListings(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.marketplaceService.getListings(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('my-listings')
  async getMyListings(@CurrentUser() user: User) {
    return this.marketplaceService.getMyListings(user.id);
  }

  @Delete('cancel/:id')
  async cancelListing(@CurrentUser() user: User, @Param('id') id: string) {
    return this.marketplaceService.cancelListing(user.id, id);
  }

  @Post('buy/:id')
  async buyListing(@CurrentUser() user: User, @Param('id') id: string) {
    return this.marketplaceService.buyListing(user.id, id);
  }
}
