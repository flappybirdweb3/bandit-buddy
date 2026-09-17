import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, Query, ParseIntPipe,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CreateListingDto, CreateItemListingDto, GetListingsQueryDto } from './dto/marketplace.dto';

@Controller('marketplace')
@UseGuards(TelegramAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  /** Returns the next nonce for an NFT listing's EIP-712 order. */
  @Get('nonce')
  async getNextNonce(
    @CurrentUser() user: User,
    @Query('nftContract') nftContract: string,
    @Query('tokenId', ParseIntPipe) tokenId: number,
  ) {
    return this.marketplaceService.getNextNonce(user.id, nftContract, tokenId);
  }

  /** Create an NFT listing (EIP-712 signed). */
  @Post('list')
  async createListing(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.marketplaceService.createListing(user.id, dto);
  }

  /** Create a user_items listing (tools, crates, seeds) — Issues #60 + #61. */
  @Post('list-item')
  async createItemListing(@CurrentUser() user: User, @Body() dto: CreateItemListingDto) {
    return this.marketplaceService.createItemListing(user.id, dto);
  }

  /**
   * Get listings. Filter by assetType and/or itemType.
   * GET /marketplace/listings?assetType=user_items&itemType=master_key
   * GET /marketplace/listings?assetType=nft
   */
  @Get('listings')
  async getListings(@Query() query: GetListingsQueryDto) {
    return this.marketplaceService.getListings(query);
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
