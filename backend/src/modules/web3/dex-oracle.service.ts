import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import axios from 'axios';
import { RedisService } from '../../common/redis.service';

const PANCAKE_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];
const PANCAKE_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const PRICE_TTL_SEC = 300;
const HISTORY_KEY = 'dex:farm:price:history';
const HISTORY_MAX = 10;
const KILL_WINDOW_MS = 5 * 60 * 1000;
const KILL_THRESHOLD_PCT = 15;
const KILL_TTL_SEC = 1800;

interface PriceHistoryEntry {
  ts: number;
  price: number;
}

@Injectable()
export class DexOracleService {
  private readonly logger = new Logger(DexOracleService.name);
  private provider: ethers.JsonRpcProvider | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */3 * * * *')
  async syncDexPrice(): Promise<void> {
    try {
      await this.doSync();
    } catch (err) {
      this.logger.warn(`DEX sync failed, retrying in 2s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        await this.doSync();
      } catch (err2) {
        this.logger.error(`DEX sync failed after retry: ${(err2 as Error).message}`);
      }
    }
  }

  private async doSync(): Promise<void> {
    const factoryAddr = this.config.get<string>('PANCAKE_FACTORY_ADDRESS');
    const farmAddr = this.config.get<string>('FARM_TOKEN_ADDRESS');
    const wbnbAddr = this.config.get<string>('WBNB_ADDRESS');
    const rpcUrl = this.config.get<string>('RPC_URL');

    if (!factoryAddr || !farmAddr || !wbnbAddr || !rpcUrl) {
      this.logger.warn(
        'DEX oracle skipped: missing env (PANCAKE_FACTORY_ADDRESS / FARM_TOKEN_ADDRESS / WBNB_ADDRESS / RPC_URL)',
      );
      return;
    }

    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
    }

    const factory = new ethers.Contract(factoryAddr, PANCAKE_FACTORY_ABI, this.provider);
    const pairAddr: string = await factory.getPair(farmAddr, wbnbAddr);

    if (!pairAddr || pairAddr.toLowerCase() === ZERO_ADDRESS) {
      this.logger.warn('DEX oracle: Pool not yet created for FARM/WBNB — skipping');
      return;
    }

    const pair = new ethers.Contract(pairAddr, PANCAKE_PAIR_ABI, this.provider);
    const [reserves, token0] = await Promise.all([pair.getReserves(), pair.token0()]);

    const reserve0: bigint = reserves[0];
    const reserve1: bigint = reserves[1];

    const farmIsToken0 = token0.toLowerCase() === farmAddr.toLowerCase();
    const reserveFarm = farmIsToken0 ? reserve0 : reserve1;
    const reserveWbnb = farmIsToken0 ? reserve1 : reserve0;

    if (reserveFarm === 0n) {
      this.logger.warn('DEX oracle: FARM reserve is zero, skipping');
      return;
    }

    const farmFloat = Number(ethers.formatUnits(reserveFarm, 18));
    const wbnbFloat = Number(ethers.formatUnits(reserveWbnb, 18));
    const priceInBnb = wbnbFloat / farmFloat;

    const bnbUsdPrice = await this.fetchBnbUsd();
    const priceInUsd = priceInBnb * bnbUsdPrice;

    await this.redis.set('dex:farm:price:bnb', priceInBnb.toString(), PRICE_TTL_SEC);
    await this.redis.set('dex:farm:price:usd', priceInUsd.toString(), PRICE_TTL_SEC);
    await this.appendHistory({ ts: Date.now(), price: priceInUsd });

    // Track daily open price and hourly snapshots for 24h growth calculation
    const todayUtc = new Date().toISOString().slice(0, 10);
    const hourSlot = new Date().toISOString().slice(0, 13);
    const openKey = `dex:farm:price:open:${todayUtc}`;
    const openExists = await this.redis.get(openKey);
    if (!openExists) {
      await this.redis.set(openKey, priceInUsd.toString(), 7 * 86400);
    }
    await this.redis.set(`dex:farm:price:hourly:${hourSlot}`, priceInUsd.toString(), 3 * 86400);

    await this.checkKillSwitch();

    this.logger.log(`DEX price synced: $${priceInUsd.toFixed(6)} USD / ${priceInBnb.toFixed(8)} BNB`);
  }

  private async fetchBnbUsd(): Promise<number> {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
      { timeout: 8000 },
    );
    const price = res?.data?.binancecoin?.usd;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
      throw new Error(`Invalid BNB/USD from CoinGecko: ${JSON.stringify(res?.data)}`);
    }
    return price;
  }

  private async appendHistory(entry: PriceHistoryEntry): Promise<void> {
    const raw = await this.redis.get(HISTORY_KEY);
    let history: PriceHistoryEntry[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) history = parsed;
      } catch {
        history = [];
      }
    }
    history.push(entry);
    if (history.length > HISTORY_MAX) {
      history = history.slice(history.length - HISTORY_MAX);
    }
    await this.redis.set(HISTORY_KEY, JSON.stringify(history), 600);
  }

  async checkKillSwitch(): Promise<void> {
    const raw = await this.redis.get(HISTORY_KEY);
    if (!raw) return;

    let history: PriceHistoryEntry[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      history = parsed;
    } catch {
      return;
    }

    const cutoff = Date.now() - KILL_WINDOW_MS;
    const window = history.filter((e) => e && typeof e.ts === 'number' && e.ts >= cutoff);
    if (window.length < 2) return;

    const oldest = window[0];
    const current = window[window.length - 1];
    if (!oldest.price || oldest.price <= 0) return;

    const pctChange = ((current.price - oldest.price) / oldest.price) * 100;

    if (Math.abs(pctChange) > KILL_THRESHOLD_PCT) {
      const direction = pctChange > 0 ? 'up' : 'down';
      const reason = `${direction} ${Math.abs(pctChange).toFixed(1)}% in 5min`;
      await this.redis.set('kill_switch:active', '1', KILL_TTL_SEC);
      await this.redis.set('kill_switch:reason', reason, KILL_TTL_SEC);
      this.logger.warn(`Kill switch ACTIVATED: $FARM price ${reason}`);
      return;
    }

    const active = await this.redis.get('kill_switch:active');
    if (active) {
      await this.redis.del('kill_switch:active');
      await this.redis.del('kill_switch:reason');
      this.logger.log('Kill switch DEACTIVATED: price stabilized');
    }
  }

  async getDexPrice(): Promise<{ priceUsd: number; priceBnb: number; source: string } | null> {
    const [usdRaw, bnbRaw] = await Promise.all([
      this.redis.get('dex:farm:price:usd'),
      this.redis.get('dex:farm:price:bnb'),
    ]);
    if (!usdRaw || !bnbRaw) return null;
    const priceUsd = Number(usdRaw);
    const priceBnb = Number(bnbRaw);
    if (!isFinite(priceUsd) || !isFinite(priceBnb)) return null;
    return { priceUsd, priceBnb, source: 'pancakeswap-v2' };
  }

  async isKillSwitchActive(): Promise<boolean> {
    return !!(await this.redis.get('kill_switch:active'));
  }

  async getKillSwitchReason(): Promise<string | null> {
    return this.redis.get('kill_switch:reason');
  }

  /**
   * Computes 24h price growth percentage of $FARM/USDT.
   * Compares current DEX price against 24h ago hourly snapshot or yesterday open price.
   */
  async getPriceGrowth24h(): Promise<{ currentPrice: number; price24hAgo: number; growthPercent: number }> {
    const dex = await this.getDexPrice();
    const currentPrice = dex?.priceUsd && dex.priceUsd > 0 ? dex.priceUsd : 0.000146;

    const now = Date.now();
    const ts24hAgo = new Date(now - 24 * 3600 * 1000);
    const yesterdayDate = ts24hAgo.toISOString().slice(0, 10);
    const yesterdayHourSlot = ts24hAgo.toISOString().slice(0, 13);

    let price24hAgoRaw = await this.redis.get(`dex:farm:price:hourly:${yesterdayHourSlot}`);
    if (!price24hAgoRaw) {
      price24hAgoRaw = await this.redis.get(`dex:farm:price:open:${yesterdayDate}`);
    }

    if (!price24hAgoRaw) {
      const todayUtc = new Date().toISOString().slice(0, 10);
      price24hAgoRaw = await this.redis.get(`dex:farm:price:open:${todayUtc}`);
    }

    const price24hAgo = price24hAgoRaw ? Number(price24hAgoRaw) : currentPrice;
    const growthPercent =
      price24hAgo > 0 && currentPrice > 0
        ? ((currentPrice - price24hAgo) / price24hAgo) * 100
        : 0;

    return {
      currentPrice: Number(currentPrice.toFixed(8)),
      price24hAgo: Number(price24hAgo.toFixed(8)),
      growthPercent: Number(growthPercent.toFixed(2)),
    };
  }
}
