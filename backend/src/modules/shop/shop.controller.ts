import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ShopService } from './shop.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { IsUUID } from 'class-validator';

class BuyItemDto {
  @IsUUID()
  itemId: string;
}

@Controller('shop')
@UseGuards(TelegramAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  getItems(@CurrentUser() user: User) {
    return this.shopService.getItems(user.id);
  }

  @Post('buy')
  buyItem(@CurrentUser() user: User, @Body() dto: BuyItemDto) {
    return this.shopService.buyItem(user.id, dto.itemId);
  }
}
