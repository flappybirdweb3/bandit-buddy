import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { DexVolumeService } from './dex-volume.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { ClaimSignatureDto, RefundClaimDto, TokenizeDogDto, SetDogGuardingDto, SetDogGuardingByIdDto, DepositVerifyDto } from './dto/web3.dto';

@Controller('web3')
@UseGuards(TelegramAuthGuard)
export class Web3Controller {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly dexVolume: DexVolumeService,
  ) {}

  @Post('claim-signature')
  async claimSignature(
    @CurrentUser() user: User,
    @Body() dto: ClaimSignatureDto,
  ) {
    return this.web3Service.generateClaimSignature(user, dto.amountToClaim);
  }

  @Post('refund-claim')
  async refundClaim(
    @CurrentUser() user: User,
    @Body() dto: RefundClaimDto,
  ) {
    return this.web3Service.refundClaim(user.id, dto.nonce);
  }

  @Post('mark-claim-completed')
  async markClaimCompleted(
    @CurrentUser() user: User,
    @Body() dto: RefundClaimDto,
  ) {
    await this.web3Service.markClaimCompleted(user.id, dto.nonce);
    return { ok: true };
  }

  @Post('sync-nft')
  async syncNft(@CurrentUser() user: User) {
    if (!user.walletAddress) {
      return { synced: 0, totalNftDefense: 0, dogs: [], message: 'No wallet linked' };
    }
    const result = await this.web3Service.syncGuardDogs(user.id, user.walletAddress);
    // Degraded read: the wallet is being served from last-known-good DB state. Say so
    // explicitly instead of "Synced 0", which reads like "you own no dogs".
    if (result.unavailable) {
      return { ...result, message: 'Blockchain network unavailable — showing cached NFT state' };
    }
    return { ...result, message: `Synced ${result.synced} NFT dog(s)` };
  }

  @Get('nft-status')
  async getNftStatus(@CurrentUser() user: User) {
    return this.web3Service.getNftStatus(user.id);
  }

  @Get('shop-dogs')
  async getShopDogs(@CurrentUser() user: User) {
    return this.web3Service.getShopDogs(user.id);
  }

  @Post('tokenize-dog')
  async tokenizeDog(
    @CurrentUser() user: User,
    @Body() dto: TokenizeDogDto,
  ) {
    return this.web3Service.tokenizeDog(user, dto.count);
  }

  @Patch('nft-dog/guard')
  async setDogGuarding(
    @CurrentUser() user: User,
    @Body() dto: SetDogGuardingDto,
  ) {
    return this.web3Service.setDogGuarding(user.id, dto.tokenId, dto.isGuarding);
  }

  @Patch('dog/guard-by-id')
  async setDogGuardingById(
    @CurrentUser() user: User,
    @Body() dto: SetDogGuardingByIdDto,
  ) {
    return this.web3Service.setDogGuardingById(user.id, dto.dogId, dto.isGuarding);
  }

  @Post('dog/:dogId/feed')
  async feedDog(
    @CurrentUser() user: User,
    @Param('dogId') dogId: string,
  ) {
    return this.web3Service.feedDog(user.id, dogId);
  }

  @Get('exchange-rate')
  async getExchangeRate() {
    return this.web3Service.getExchangeRate();
  }

  // ── Deposit $FARM → GOLD (#72) ────────────────────────────────────

  @Get('deposit-info')
  getDepositInfo() {
    return this.web3Service.getDepositInfo();
  }

  @Post('deposit-verify')
  async verifyDeposit(@CurrentUser() user: User, @Body() dto: DepositVerifyDto) {
    return this.web3Service.verifyDeposit(user.id, dto.txHash);
  }

  @Get('dex-tier')
  async getDexTier(@CurrentUser() user: User) {
    const addr = user.walletAddress ?? '';
    if (!addr) return { walletAddress: '', volume24h: 0, tier: 1, buyTax: 0.03, sellTax: 0.05 };
    return this.dexVolume.getDexTier(addr);
  }
}
