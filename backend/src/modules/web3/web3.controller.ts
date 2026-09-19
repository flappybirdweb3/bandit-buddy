import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Web3Service } from './web3.service';
import { DexVolumeService } from './dex-volume.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../user/entities/user.entity';
import { ClaimSignatureDto, RefundClaimDto, TokenizeDogDto, RollbackTokenizeDogDto, SetDogGuardingDto, SetDogGuardingByIdDto, DepositVerifyDto, RedeemShardsDto, ResolveFusionDto } from './dto/web3.dto';
import { FusionOracleService } from './fusion-oracle.service';
import { TreasuryMonitorService } from './treasury-monitor.service';

@SkipThrottle({ steal: true })
@Controller('web3')
@UseGuards(TelegramAuthGuard)
export class Web3Controller {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly dexVolume: DexVolumeService,
    private readonly fusionOracle: FusionOracleService,
    private readonly treasuryMonitor: TreasuryMonitorService,
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
    return this.web3Service.refundClaim(user.id, dto.nonce, dto.unbroadcasted);
  }

  @Post('refund-all-pending')
  async refundAllPending(
    @CurrentUser() user: User,
  ) {
    return this.web3Service.refundAllPendingClaims(user.id);
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

  @Post('rollback-tokenize-dog')
  async rollbackTokenizeDog(
    @CurrentUser() user: User,
    @Body() dto: RollbackTokenizeDogDto,
  ) {
    return this.web3Service.rollbackTokenizeDog(user, dto.nonce, dto.count);
  }

  @Post('redeem-shards')
  async redeemShards(
    @CurrentUser() user: User,
    @Body() dto: RedeemShardsDto,
  ) {
    return this.web3Service.redeemShards(user, dto.count);
  }

  @Get('fusion/eligibility')
  async checkFusionEligibility(
    @CurrentUser() user: User,
    @Query('tier', ParseIntPipe) tier: number,
  ) {
    return this.web3Service.checkFusionEligibility(user.id, tier);
  }

  @Post('fusion/resolve')
  async resolveFusion(
    @CurrentUser() _user: User,
    @Body() dto: ResolveFusionDto,
  ) {
    return this.fusionOracle.resolveFusion(dto.requestId);
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

  @Get('dynamic-rates')
  async getDynamicRates() {
    return this.web3Service.getDynamicRates();
  }

  @Get('exchange-rate')
  async getExchangeRate() {
    return this.web3Service.getExchangeRate();
  }

  // ── Deposit $FARM → GOLD (#72) ────────────────────────────────────

  @Get('deposit-info')
  async getDepositInfo() {
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

  // ── Cashout Quota & Dynamic Drip-feed Pool ────────────────────────
  @Get('cashout-quota')
  async getCashoutQuota(@CurrentUser() user: User) {
    return this.web3Service.getCashoutQuota(user);
  }

  // ── Auto Buyback & Burn Treasury ──────────────────────────────────
  @Public()
  @Get('treasury-status')
  async getTreasuryStatus() {
    const [status, totalGoldConverted] = await Promise.all([
      this.treasuryMonitor.getStatus(),
      this.web3Service.getTotalGoldConverted(),
    ]);
    return { ...status, totalGoldConverted };
  }

  @Post('treasury-trigger')
  async triggerBuyBack() {
    return this.treasuryMonitor.checkAndExecuteBuyBack();
  }

  // ── BNB Tax Revenue Engine & Premium Services ──────────────────────────
  @Public()
  @Get('bnb-services-config')
  async getBnbServicesConfig() {
    return this.web3Service.getBnbServicesConfig();
  }

  @Post('verify-subscription-tx')
  async verifySubscriptionTx(
    @CurrentUser() user: User,
    @Body() dto: { txHash: string },
  ) {
    return this.web3Service.verifySubscriptionTx(user, dto.txHash);
  }
}
