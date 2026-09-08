import { Controller, Get, Patch, Body, UseGuards, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { IsEthereumAddress } from 'class-validator';

class UpdateWalletDto {
  @IsEthereumAddress()
  walletAddress: string;
}

@Controller('user')
@UseGuards(TelegramAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getLeaderboard(user.id, limit ? Math.min(parseInt(limit, 10), 100) : 50);
  }

  @Patch('wallet')
  async updateWallet(
    @CurrentUser() user: User,
    @Body() dto: UpdateWalletDto,
  ) {
    await this.userService.updateWalletAddress(user.id, dto.walletAddress);
    return { message: 'Wallet address updated' };
  }
}
