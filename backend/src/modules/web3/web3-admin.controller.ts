import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { DexOracleService } from './dex-oracle.service';
import { RedisService } from '../../common/redis.service';

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

@SkipThrottle({ steal: true })
@Controller('admin')
export class Web3AdminController {
  private provider: ethers.JsonRpcProvider | null = null;
  private readonly passcode: string;

  constructor(
    private readonly dexOracle: DexOracleService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.passcode = config.get<string>('admin.passcode') ?? '';
  }

  @Get('dex-status')
  async getDexStatus(@Query('p') p: string) {
    if (!this.passcode || p !== this.passcode) throw new UnauthorizedException('Invalid admin passcode');

    const dexPrice = await this.dexOracle.getDexPrice();
    const killSwitchActive = await this.dexOracle.isKillSwitchActive();
    const killSwitchReason = await this.dexOracle.getKillSwitchReason();
    const taxCollected24h = await this.redis.get('treasury:tax:collected:24h');

    const rpcUrl = this.config.get<string>('RPC_URL');
    const farmTokenAddress = this.config.get<string>('FARM_TOKEN_ADDRESS');
    const treasuryAddress = this.config.get<string>('TREASURY_ADDRESS');

    let treasuryFarmBalance = 0;
    let treasuryBnbBalance = 0;
    let lpLockExpiry: string | null = null;

    if (rpcUrl && farmTokenAddress && treasuryAddress) {
      try {
        if (!this.provider) this.provider = new ethers.JsonRpcProvider(rpcUrl);
        const token = new ethers.Contract(farmTokenAddress, ERC20_ABI, this.provider);
        const [farmBal, bnbBal] = await Promise.all([
          token.balanceOf(treasuryAddress) as Promise<bigint>,
          this.provider.getBalance(treasuryAddress),
        ]);
        treasuryFarmBalance = Number(ethers.formatEther(farmBal));
        treasuryBnbBalance = Number(ethers.formatEther(bnbBal));
      } catch {
        // non-fatal — return zeros
      }
    }

    return {
      farmPriceUsd: dexPrice?.priceUsd ?? 0,
      farmPriceBnb: dexPrice?.priceBnb ?? 0,
      priceSource: dexPrice?.source ?? 'unavailable',
      lastPriceUpdate: dexPrice ? new Date().toISOString() : null,
      killSwitchActive,
      killSwitchReason,
      treasuryFarmBalance,
      treasuryBnbBalance,
      totalTaxCollected24h: taxCollected24h ? Number(taxCollected24h) : 0,
      lpLockExpiry,
    };
  }
}
