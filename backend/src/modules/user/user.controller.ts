import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { UserService } from './user.service';
import { Web3Service } from '../web3/web3.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { IsEthereumAddress } from 'class-validator';
import { ConfigService } from '@nestjs/config';

class UpdateWalletDto {
  @IsEthereumAddress()
  walletAddress: string;
}

@SkipThrottle({ steal: true })
@Controller('user')
@UseGuards(TelegramAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly web3Service: Web3Service,
    private readonly config: ConfigService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('notifications')
  async setNotifications(
    @CurrentUser() user: User,
    @Body('enabled') enabled: boolean,
  ) {
    await this.userService.setNotifications(user.id, enabled);
    return { enabled };
  }

  @Post('daily-claim')
  async claimDaily(@CurrentUser() user: User) {
    return this.userService.claimDaily(user.id);
  }

  @Get('friends')
  async getFriends(@CurrentUser() user: User) {
    return this.userService.getFriends(user.id);
  }

  @Get('referral')
  async getReferral(@CurrentUser() user: User) {
    const botUsername = this.config.get<string>('telegram.botUsername') ?? 'BanditBuddyBot';
    return this.userService.getReferralInfo(user, botUsername);
  }

  @Get('search')
  async searchUsers(
    @CurrentUser() user: User,
    @Query('q') q: string,
  ) {
    return this.userService.searchUsers(user.id, q ?? '');
  }

  @Get('explore')
  async getExploreFarms(@CurrentUser() user: User) {
    return this.userService.getExploreFarms(user.id);
  }

  @Get('achievements')
  async getAchievements(@CurrentUser() user: User) {
    return this.userService.getAchievements(user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const cat = (['thieves', 'rich', 'streak', 'farmer'].includes(category ?? '') ? category : 'thieves') as 'thieves' | 'rich' | 'streak' | 'farmer';
    return this.userService.getLeaderboard(user.id, limit ? Math.min(parseInt(limit, 10), 100) : 50, cat);
  }

  @Delete('wallet')
  async unlinkWallet(@CurrentUser() user: User) {
    await this.userService.unlinkWalletAddress(user.id);
    return { message: 'Wallet unlinked' };
  }

  @Patch('wallet')
  async updateWallet(
    @CurrentUser() user: User,
    @Body() dto: UpdateWalletDto,
  ) {
    await this.userService.updateWalletAddress(user.id, dto.walletAddress);
    // Fire-and-forget NFT sync so wallet linking also picks up existing NFT dogs
    this.web3Service.syncGuardDogs(user.id, dto.walletAddress).catch(() => {});
    return { message: 'Wallet address updated' };
  }
}
