import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { ClaimSignatureDto } from './dto/web3.dto';

@Controller('web3')
@UseGuards(TelegramAuthGuard)
export class Web3Controller {
  constructor(private readonly web3Service: Web3Service) {}

  @Post('claim-signature')
  async claimSignature(
    @CurrentUser() user: User,
    @Body() dto: ClaimSignatureDto,
  ) {
    return this.web3Service.generateClaimSignature(user, dto.amountToClaim);
  }

  @Post('sync-nft')
  async syncNft(@CurrentUser() user: User) {
    if (!user.walletAddress) {
      return { synced: 0, totalNftDefense: 0, dogs: [], message: 'No wallet linked' };
    }
    const result = await this.web3Service.syncGuardDogs(user.id, user.walletAddress);
    return { ...result, message: `Synced ${result.synced} NFT dog(s)` };
  }

  @Get('nft-status')
  async getNftStatus(@CurrentUser() user: User) {
    return this.web3Service.getNftStatus(user.id);
  }

  @Get('exchange-rate')
  async getExchangeRate() {
    return this.web3Service.getExchangeRate();
  }
}
