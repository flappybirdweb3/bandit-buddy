import {
  Controller, Post, Body, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ActionService } from './action.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { PlantDto, HarvestDto, StealDto } from './dto/action.dto';

@Controller('action')
@UseGuards(TelegramAuthGuard)
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Post('plant')
  async plant(@CurrentUser() user: User, @Body() dto: PlantDto) {
    return this.actionService.plant(user.id, dto);
  }

  @Post('harvest')
  async harvest(@CurrentUser() user: User, @Body() dto: HarvestDto) {
    return this.actionService.harvest(user.id, dto);
  }

  // Rate limit: max 3 requests per second per user (anti-bot)
  @Post('steal')
  @Throttle({ steal: { limit: 3, ttl: 1000 } })
  async steal(@CurrentUser() user: User, @Body() dto: StealDto) {
    return this.actionService.steal(user.id, dto);
  }
}
