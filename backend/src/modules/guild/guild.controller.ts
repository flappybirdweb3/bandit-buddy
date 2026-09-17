import {
  Controller, Get, Post, Delete, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { GuildService } from './guild.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { SetPreferredSeedDto } from './dto/set-preferred-seed.dto';

class CreateGuildDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

class JoinGuildDto {
  @IsString() @IsNotEmpty() guildId!: string;
}

class BuySubDto {
  @IsString() @IsNotEmpty() effectType!: string;
}

class StakeDto {
  @IsNumber() @Min(1) amount!: number;
}

class SetTaxRateDto {
  @IsNumber() @Min(0.01) @Max(0.05) taxRate!: number;
}

class LinkGroupDto {
  @IsString() @IsNotEmpty() telegramGroupId!: string;
}

class RaidGuildDto {
  @IsString() @IsNotEmpty() targetGuildId!: string;
}

class WaterTreeDto {
  @IsOptional() @IsString() guildId?: string;
}

@UseGuards(TelegramAuthGuard)
@SkipThrottle({ steal: true })
@Controller('guild')
export class GuildController {
  constructor(private readonly guildService: GuildService) {}

  // ── Guild endpoints ────────────────────────────────────────────────────────

  @Get('list')
  listGuilds(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.guildService.listGuilds(limit, offset);
  }

  @Get('my')
  async getMyGuild(@CurrentUser() user: User, @Res() res: Response) {
    const guild = await this.guildService.getMyGuild(user.id);
    return res.json(guild ?? null);
  }

  @Post('create')
  createGuild(@CurrentUser() user: User, @Body() dto: CreateGuildDto) {
    return this.guildService.createGuild(user.id, dto.name);
  }

  @Post('join')
  joinGuild(@CurrentUser() user: User, @Body() dto: JoinGuildDto) {
    return this.guildService.joinGuild(user.id, dto.guildId);
  }

  @Delete('leave')
  leaveGuild(@CurrentUser() user: User) {
    return this.guildService.leaveGuild(user.id);
  }

  @Delete('disband')
  disbandGuild(@CurrentUser() user: User) {
    return this.guildService.disbandGuild(user.id);
  }

  @Post('upgrade-elite')
  upgradeToElite(@CurrentUser() user: User) {
    return this.guildService.upgradeToElite(user.id);
  }

  @Post('stake')
  stakeToGuild(@CurrentUser() user: User, @Body() dto: StakeDto) {
    return this.guildService.stakeToGuild(user.id, dto.amount);
  }

  // ── World Tree Social-Fi endpoints ────────────────────────────────────────

  @Post('water')
  waterTree(@CurrentUser() user: User, @Body() dto: WaterTreeDto) {
    return this.guildService.waterTree(user.id, dto?.guildId);
  }

  @Post('claim-reward')
  claimTreeReward(@CurrentUser() user: User) {
    return this.guildService.claimTreeReward(user.id);
  }

  @Post('buy-shield')
  buyShield(@CurrentUser() user: User) {
    return this.guildService.buyShield(user.id);
  }

  @Post('auto-compound')
  autoCompound(@CurrentUser() user: User) {
    return this.guildService.autoCompound(user.id);
  }

  @Post('raid')
  raidGuildTree(@CurrentUser() user: User, @Body() dto: RaidGuildDto) {
    return this.guildService.raidGuildTree(user.id, dto.targetGuildId);
  }

  @Post('set-tax-rate')
  setTaxRate(@CurrentUser() user: User, @Body() dto: SetTaxRateDto) {
    return this.guildService.setTaxRate(user.id, dto.taxRate);
  }

  @Post('link-group')
  linkTelegramGroup(@CurrentUser() user: User, @Body() dto: LinkGroupDto) {
    return this.guildService.linkTelegramGroup(user.id, dto.telegramGroupId);
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

  @Post('subscription/butler/seed')
  setButlerPreferredSeed(@CurrentUser() user: User, @Body() dto: SetPreferredSeedDto) {
    return this.guildService.setButlerPreferredSeed(user.id, dto.seedId ?? null);
  }
}
