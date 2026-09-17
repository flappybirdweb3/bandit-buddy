import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { RedisService } from '../../common/redis.service';

const PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'function token0() external view returns (address)',
];

const FARM_TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

// Holdings-based tier thresholds matching FarmToken V2 (Option A)
const TIER2_BALANCE = 10_000;  // FARM
const TIER3_BALANCE = 50_000;  // FARM

const TIER_RATES = [
  { buy: 0.03, sell: 0.05 },
  { buy: 0.02, sell: 0.03 },
  { buy: 0.01, sell: 0.015 },
];

function computeTierFromBalance(balanceFarm: number): number {
  if (balanceFarm < TIER2_BALANCE) return 1;
  if (balanceFarm < TIER3_BALANCE) return 2;
  return 3;
}

@Injectable()
export class DexVolumeService {
  private readonly logger = new Logger(DexVolumeService.name);
  private lastScannedBlock = 0;
  private farmIsToken0: boolean | null = null;
  private provider: ethers.JsonRpcProvider | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async syncSwapVolumes(): Promise<void> {
    try {
      const pairAddr = this.config.get<string>('PANCAKE_PAIR_ADDRESS');
      const rpcUrl = this.config.get<string>('RPC_URL');
      const farmAddr = this.config.get<string>('FARM_TOKEN_ADDRESS');

      if (!pairAddr) {
        this.logger.warn('DexVolumeService: PANCAKE_PAIR_ADDRESS not set, skipping');
        return;
      }
      if (!rpcUrl || !farmAddr) return;

      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
      }

      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastScannedBlock === 0
        ? Math.max(0, currentBlock - 100)
        : this.lastScannedBlock + 1;

      if (fromBlock > currentBlock) return;

      // Resolve token0 once via eth_call
      if (this.farmIsToken0 === null) {
        const pair = new ethers.Contract(pairAddr, PAIR_ABI, this.provider);
        const token0: string = await pair.token0();
        this.farmIsToken0 = token0.toLowerCase() === farmAddr.toLowerCase();
      }

      // Swap(address,uint256,uint256,uint256,uint256,address)
      const SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
      // Public BSC Testnet nodes allow ~50-block windows on eth_getLogs
      const CHUNK = 50;
      const rawLogs: ethers.Log[] = [];

      for (let from = fromBlock; from <= currentBlock; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, currentBlock);
        const logs = await this.provider.getLogs({
          address: pairAddr,
          topics: [SWAP_TOPIC],
          fromBlock: from,
          toBlock: to,
        });
        rawLogs.push(...logs);
        if (to < currentBlock) await new Promise((r) => setTimeout(r, 1000));
      }

      const iface = new ethers.Interface(PAIR_ABI);
      for (const log of rawLogs) {
        let decoded: ethers.LogDescription | null = null;
        try { decoded = iface.parseLog(log); } catch { continue; }
        if (!decoded) continue;

        const { sender, amount0In, amount0Out, amount1In, amount1Out, to } = decoded.args as unknown as {
          sender: string; amount0In: bigint; amount0Out: bigint;
          amount1In: bigint; amount1Out: bigint; to: string;
        };

        const isBuy = this.farmIsToken0 ? amount0Out > 0n : amount1Out > 0n;
        const farmAmount: bigint = this.farmIsToken0
          ? (isBuy ? amount0Out : amount0In)
          : (isBuy ? amount1Out : amount1In);

        const user: string = isBuy ? to : sender;
        if (user.toLowerCase() === pairAddr.toLowerCase()) continue;

        const farmFloat = Number(ethers.formatUnits(farmAmount, 18));
        const redisKey = `dex:vol:24h:${user.toLowerCase()}`;
        const existing = Number(await this.redis.get(redisKey) ?? '0');
        const newVol = existing + farmFloat;

        await this.redis.set(redisKey, newVol.toString(), 86400);

        const tier = computeTierFromBalance(newVol);
        await this.dataSource.manager.query(
          `INSERT INTO dex_trade_volume (wallet_address, volume_24h, tier, last_trade_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (wallet_address) DO UPDATE
           SET volume_24h = $2, tier = $3, last_trade_at = NOW(), updated_at = NOW()`,
          [user.toLowerCase(), newVol, tier],
        );
      }

      this.lastScannedBlock = currentBlock;
      this.logger.log(`DexVolume: synced ${rawLogs.length} Swap events through block ${currentBlock}`);
    } catch (err) {
      this.logger.error(`DexVolumeService.syncSwapVolumes failed: ${(err as Error).message}`);
    }
  }

  async getDexTier(walletAddress: string): Promise<{
    walletAddress: string;
    balanceFarm: number;
    volume24h: number;
    tier: number;
    buyTax: number;
    sellTax: number;
  }> {
    const addr = walletAddress.toLowerCase();

    // Tier is holdings-based (FarmToken V2 Option A): read on-chain FARM balance
    let balanceFarm = 0;
    try {
      const rpcUrl = this.config.get<string>('RPC_URL');
      const farmAddr = this.config.get<string>('FARM_TOKEN_ADDRESS');
      if (rpcUrl && farmAddr) {
        if (!this.provider) {
          this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
        }
        const farmContract = new ethers.Contract(farmAddr, FARM_TOKEN_ABI, this.provider);
        const raw: bigint = await farmContract.balanceOf(addr);
        balanceFarm = Number(ethers.formatUnits(raw, 18));
      }
    } catch (err) {
      this.logger.warn(`getDexTier: balanceOf failed for ${addr}: ${(err as Error).message}`);
    }

    // Also read 24h volume from Redis/DB for informational display
    let volume24h = 0;
    try {
      const raw = await this.redis.get(`dex:vol:24h:${addr}`);
      if (raw) {
        volume24h = Number(raw);
      } else {
        const rows = await this.dataSource.manager.query(
          'SELECT volume_24h FROM dex_trade_volume WHERE wallet_address = $1',
          [addr],
        ) as { volume_24h: string }[];
        if (rows[0]) volume24h = Number(rows[0].volume_24h);
      }
    } catch {
      // ignore — volume is informational only
    }

    const tier = computeTierFromBalance(balanceFarm);
    const rates = TIER_RATES[tier - 1];
    return { walletAddress: addr, balanceFarm, volume24h, tier, buyTax: rates.buy, sellTax: rates.sell };
  }
}
