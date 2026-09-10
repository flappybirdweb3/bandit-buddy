import {
  Controller, Get, Post, Delete, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { GuildService } from './guild.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

class CreateGuildDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

class JoinGuildDto {
  @IsString() @IsNotEmpty() guildId!: string;
}

class BuySubDto {
  @IsString() @IsNotEmpty() effectType!: string;
}

@UseGuards(TelegramAuthGuard)
@Controller()
export class GuildController {
  constructor(private readonly guildService: GuildService) {}

  // ── Guild endpoints ────────────────────────────────────────────────────────

  @Get('guild/list')
  listGuilds(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.guildService.listGuilds(limit, offset);
  }

  @Get('guild/my')
  getMyGuild(@CurrentUser() user: User) {
    return this.guildService.getMyGuild(user.id);
  }

  @Post('guild/create')
  createGuild(@CurrentUser() user: User, @Body() dto: CreateGuildDto) {
    return this.guildService.createGuild(user.id, dto.name);
  }

  @Post('guild/join')
  joinGuild(@CurrentUser() user: User, @Body() dto: JoinGuildDto) {
    return this.guildService.joinGuild(user.id, dto.guildId);
  }

  @Delete('guild/leave')
  leaveGuild(@CurrentUser() user: User) {
    return this.guildService.leaveGuild(user.id);
  }

  @Delete('guild/disband')
  disbandGuild(@CurrentUser() user: User) {
    return this.guildService.disbandGuild(user.id);
  }

  @Post('guild/upgrade-elite')
  upgradeToElite(@CurrentUser() user: User) {
    return this.guildService.upgradeToElite(user.id);
  }

  // ── Subscription endpoints ─────────────────────────────────────────────────

  @Get('subscription/status')
  getSubscriptionStatus(@CurrentUser() user: User) {
    return this.guildService.getSubscriptionStatus(user.id);
  }

  @Post('subscription/buy')
  purchaseSubscription(@CurrentUser() user: User, @Body() dto: BuySubDto) {
    return this.guildService.purchaseSubscription(user.id, dto.effectType);
  }
}
