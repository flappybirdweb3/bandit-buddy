import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { GuildService } from './guild.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { IsString, IsNotEmpty } from 'class-validator';
import { SetPreferredSeedDto } from './dto/set-preferred-seed.dto';

class BuySubDto {
  @IsString() @IsNotEmpty() effectType!: string;
}

@UseGuards(TelegramAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly guildService: GuildService) {}

  @Get('status')
  getSubscriptionStatus(@CurrentUser() user: User) {
    return this.guildService.getSubscriptionStatus(user.id);
  }

  @Post('buy')
  purchaseSubscription(@CurrentUser() user: User, @Body() dto: BuySubDto) {
    return this.guildService.purchaseSubscription(user.id, dto.effectType);
  }

  @Post('butler/seed')
  setButlerPreferredSeed(@CurrentUser() user: User, @Body() dto: SetPreferredSeedDto) {
    return this.guildService.setButlerPreferredSeed(user.id, dto.seedId ?? null);
  }
}
