import {
  Controller, Get, Post, Body, UseGuards,
} from '@nestjs/common';
import { ActionService } from './action.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { PlantDto, HarvestDto, StealDto, PlotIdDto, ThrowAttackDto, FertilizeDto, RevealThiefDto, RepairDto } from './dto/action.dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

// Class-level skip: non-steal methods are exempt from the 3/sec steal throttler.
// The steal endpoint's @Throttle({ steal: {...} }) overrides this at the method level.
@SkipThrottle({ steal: true })
@Controller('action')
@UseGuards(TelegramAuthGuard)
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Post('plant')
  async plant(@CurrentUser() user: User, @Body() dto: PlantDto) {
    return this.actionService.plant(user.id, dto);
  }

  @SkipThrottle()
  @Post('harvest')
  async harvest(@CurrentUser() user: User, @Body() dto: HarvestDto) {
    return this.actionService.harvest(user.id, dto);
  }

  @Post('harvest-all')
  async harvestAll(@CurrentUser() user: User) {
    return this.actionService.harvestAll(user.id);
  }

  @Post('plant-all')
  async plantAll(@CurrentUser() user: User, @Body('seedId') seedId: string) {
    return this.actionService.plantAll(user.id, seedId);
  }

  // Strict rate limit: 3 steal attempts per second per user.
  // The 'steal' named throttler (ttl:1000, limit:3) is defined in app.module.ts.
  // Do NOT add @SkipThrottle() here — steal is exactly the endpoint bots abuse.
  @SkipThrottle({ steal: false })  // override class @SkipThrottle({ steal: true }) → re-enable steal throttler
  @Throttle({ steal: { limit: 3, ttl: 1000 } })
  @Post('steal')
  async steal(@CurrentUser() user: User, @Body() dto: StealDto) {
    return this.actionService.steal(user.id, dto);
  }

  @Post('dig')
  async dig(@CurrentUser() user: User, @Body() dto: PlotIdDto) {
    return this.actionService.dig(user.id, dto.plotId);
  }

  @Post('water')
  async water(@CurrentUser() user: User, @Body() dto: PlotIdDto) {
    return this.actionService.water(user.id, dto.plotId);
  }

  @Post('fertilize')
  async fertilize(@CurrentUser() user: User, @Body() dto: FertilizeDto) {
    return this.actionService.fertilize(user.id, dto.plotId, dto.tier ?? 'auto');
  }

  @Post('throw')
  async throwAttack(@CurrentUser() user: User, @Body() dto: ThrowAttackDto) {
    return this.actionService.throwAttack(user.id, dto);
  }

  @Post('weed-kill')
  async weedKill(@CurrentUser() user: User, @Body() dto: PlotIdDto) {
    return this.actionService.weedKill(user.id, dto.plotId);
  }

  @Post('bug-spray')
  async bugSpray(@CurrentUser() user: User, @Body() dto: PlotIdDto) {
    return this.actionService.bugSpray(user.id, dto.plotId);
  }

  @Get('activity')
  async getActivity(@CurrentUser() user: User) {
    return this.actionService.getActivityFeed(user.id);
  }

  @Post('reveal-thief')
  async revealThief(@CurrentUser() user: User, @Body() dto: RevealThiefDto) {
    return this.actionService.revealThief(user.id, dto);
  }

  @Get('buildings')
  async getBuildingStatus(@CurrentUser() user: User) {
    return this.actionService.getBuildingStatus(user.id);
  }

  @Post('repair')
  async repairBuilding(@CurrentUser() user: User, @Body() dto: RepairDto) {
    return this.actionService.repairBuilding(user.id, dto.target, dto.amount);
  }
}