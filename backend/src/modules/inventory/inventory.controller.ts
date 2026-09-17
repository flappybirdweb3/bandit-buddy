import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SellCropsDto, PackCrateDto, UnpackCrateDto } from './dto/inventory.dto';

@SkipThrottle({ steal: true })
@Controller('inventory')
@UseGuards(TelegramAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory(@CurrentUser() user: User) {
    return this.inventoryService.getInventory(user.id);
  }

  /** Sell crop items to system — 1 unit = 1 GOLD */
  @Post('sell')
  async sellCrops(@CurrentUser() user: User, @Body() dto: SellCropsDto) {
    return this.inventoryService.sellCrops(user.id, dto);
  }

  /** Sell ALL raw crop items to system — 1 unit = 1 GOLD */
  @Post('sell-all')
  async sellAllCrops(@CurrentUser() user: User) {
    return this.inventoryService.sellAllCrops(user.id);
  }

  /** Pack crop units into a tradeable crate */
  @Post('pack-crate')
  async packCrate(@CurrentUser() user: User, @Body() dto: PackCrateDto) {
    return this.inventoryService.packCrate(user.id, dto);
  }

  /** Unpack crates back into crop units */
  @Post('unpack-crate')
  async unpackCrate(@CurrentUser() user: User, @Body() dto: UnpackCrateDto) {
    return this.inventoryService.unpackCrate(user.id, dto);
  }

  /** Aggregated Barn / Storage: items + dogs + fertilizer in one call */
  @Get('barn')
  async getBarnData(@CurrentUser() user: User) {
    return this.inventoryService.getBarnData(user.id);
  }
}
