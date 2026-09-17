import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UnauthorizedException, UseGuards, Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { User } from './entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { Throttle } from '@nestjs/throttler';

const ORACLE_LOW_BNB   = 0.05;   // red alert
const ORACLE_WARN_BNB  = 0.10;   // yellow warning

// Simple passcode guard (not a full auth system — admin is internal tooling only)
function requireAdmin(passcode: string | undefined, expected: string): void {
  if (!expected || passcode !== expected) throw new UnauthorizedException('Invalid admin passcode');
}

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  private readonly passcode: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)     private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot) private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(StealLog) private readonly stealRepo: Repository<StealLog>,
    @InjectRepository(SeedConfig) private readonly seedRepo: Repository<SeedConfig>,
    @InjectDataSource()         private readonly ds: DataSource,
  ) {
    this.passcode = config.get<string>('admin.passcode') ?? '';
  }

  // GET /api/admin/users?p=PASSCODE&q=username&page=1
  @Get('users')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listUsers(
    @Query('p') p: string,
    @Query('q') q: string = '',
    @Query('page') rawPage: string = '1',
  ) {
    requireAdmin(p, this.passcode);
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const [users, total] = await this.userRepo.findAndCount({
      where: q ? { username: Like(`%${q}%`) } : {},
      order: { createdAt: 'DESC' },
      take: 20,
      skip: (page - 1) * 20,
    });
    return {
      users: users.map(u => ({
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        goldBalance: Number(u.goldBalance),
        energy: u.energy,
        trustScore: u.trustScore,
        dailyStreak: u.dailyStreak,
        totalHarvests: u.totalHarvests,
        totalPlants: u.totalPlants,
        goldStolen: Number(u.goldStolen),
        walletAddress: u.walletAddress,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / 20),
    };
  }

  // GET /api/admin/stats?p=PASSCODE
  @Get('stats')
  async globalStats(@Query('p') p: string) {
    requireAdmin(p, this.passcode);
    const [
      totalUsers,
      totalPlots,
      totalSteals,
      totalGold,
    ] = await Promise.all([
      this.userRepo.count(),
      this.plotRepo.count(),
      this.stealRepo.count(),
      this.userRepo
        .createQueryBuilder('u')
        .select('SUM(u.gold_balance)', 'total')
        .getRawOne<{ total: string }>(),
    ]);
    return {
      totalUsers,
      totalPlots,
      totalSteals,
      totalGoldInCirculation: Math.floor(Number(totalGold?.total ?? 0)),
    };
  }

  // PATCH /api/admin/users/:id/gold — add/remove gold
  @Patch('users/:id/gold')
  async adjustGold(
    @Param('id') id: string,
    @Query('p') p: string,
    @Body() body: { amount: number; reason: string },
  ) {
    requireAdmin(p, this.passcode);
    if (body.amount > 0) {
      await this.userRepo.increment({ id }, 'goldBalance', body.amount);
    } else {
      await this.userRepo.decrement({ id }, 'goldBalance', Math.abs(body.amount));
    }
    this.logger.log(`[Admin] Adjusted gold for user ${id}: ${body.amount} — ${body.reason}`);
    return { ok: true, amount: body.amount };
  }

  // PATCH /api/admin/users/:id/trust
  @Patch('users/:id/trust')
  async adjustTrust(
    @Param('id') id: string,
    @Query('p') p: string,
    @Body() body: { score: number },
  ) {
    requireAdmin(p, this.passcode);
    await this.userRepo.update(id, { trustScore: body.score });
    return { ok: true };
  }

  // GET /api/admin/steal-logs?p=PASSCODE&page=1
  @Get('steal-logs')
  async stealLogs(@Query('p') p: string, @Query('page') rawPage: string = '1') {
    requireAdmin(p, this.passcode);
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const [logs, total] = await this.stealRepo.findAndCount({
      relations: ['thief', 'victim'],
      order: { createdAt: 'DESC' },
      take: 30,
      skip: (page - 1) * 30,
    });
    return {
      logs: logs.map(l => ({
        id: l.id,
        thief: l.thief?.username,
        victim: l.victim?.username,
        amount: Number(l.amount),
        success: l.success,
        createdAt: l.createdAt,
      })),
      total,
    };
  }

  // GET /api/admin/seeds?p=PASSCODE
  @Get('seeds')
  async listSeeds(@Query('p') p: string) {
    requireAdmin(p, this.passcode);
    return this.seedRepo.find({ order: { costGold: 'ASC' } });
  }

  // PATCH /api/admin/seeds/:id
  @Patch('seeds/:id')
  async updateSeed(
    @Param('id') id: string,
    @Query('p') p: string,
    @Body() body: { costGold?: number; growTimeSec?: number; baseYield?: number },
  ) {
    requireAdmin(p, this.passcode);
    await this.seedRepo.update(id, body);
    this.logger.log(`[Admin] Updated seed ${id}: ${JSON.stringify(body)}`);
    return { ok: true };
  }

  // ── Oracle Wallet Gas Monitor (#59) ──────────────────────────────────────────

  // GET /api/admin/oracle-wallet?p=PASSCODE
  @Get('oracle-wallet')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getOracleWalletBalance(@Query('p') p: string) {
    requireAdmin(p, this.passcode);
    const rpcUrl = this.config.get<string>('web3.bscRpcUrl') ?? 'https://bsc-dataseed.binance.org/';
    const signerKey = this.config.get<string>('web3.signerPrivateKey');
    if (!signerKey) return { bnbBalance: null, status: 'unknown', message: 'SIGNER_PRIVATE_KEY not set' };

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(signerKey);
    const balance = await provider.getBalance(wallet.address);
    const bnbBalance = parseFloat(ethers.formatEther(balance));
    const status = bnbBalance < ORACLE_LOW_BNB ? 'critical' : bnbBalance < ORACLE_WARN_BNB ? 'warning' : 'ok';

    return {
      address: wallet.address,
      bnbBalance: parseFloat(bnbBalance.toFixed(6)),
      status,
      thresholds: { critical: ORACLE_LOW_BNB, warning: ORACLE_WARN_BNB },
    };
  }

  // Cron: alert via logger every 10 min when oracle balance is low
  @Cron('*/10 * * * *')
  async checkOracleWalletBalance(): Promise<void> {
    const signerKey = this.config.get<string>('web3.signerPrivateKey');
    if (!signerKey) return;
    try {
      const rpcUrl = this.config.get<string>('web3.bscRpcUrl') ?? 'https://bsc-dataseed.binance.org/';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(signerKey);
      const balance = await provider.getBalance(wallet.address);
      const bnbBalance = parseFloat(ethers.formatEther(balance));
      if (bnbBalance < ORACLE_LOW_BNB) {
        this.logger.error(`ORACLE WALLET CRITICAL: ${wallet.address} = ${bnbBalance.toFixed(4)} BNB — Gacha will halt!`);
      } else if (bnbBalance < ORACLE_WARN_BNB) {
        this.logger.warn(`Oracle wallet low: ${wallet.address} = ${bnbBalance.toFixed(4)} BNB`);
      }
    } catch (err: any) {
      this.logger.error(`Oracle wallet check failed: ${err.message}`);
    }
  }

  // GET /api/admin/economy?p=PASSCODE — economy overview for dashboard
  @Get('economy')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getEconomy(@Query('p') p: string) {
    requireAdmin(p, this.passcode);
    const [goldCirc, activeUsers24h, activeUsers7d, stealsToday, harvestsToday] = await Promise.all([
      this.ds.query(`SELECT COALESCE(SUM(gold_balance), 0)::float AS total FROM users`),
      this.ds.query(`SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '24 hours'`),
      this.ds.query(`SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '7 days'`),
      this.ds.query(`SELECT COUNT(*) FROM steal_logs WHERE created_at > NOW() - INTERVAL '24 hours'`),
      this.ds.query(`SELECT COUNT(*) FROM farm_plots WHERE planted_at IS NULL AND total_stolen = 0 AND updated_at > NOW() - INTERVAL '24 hours'`),
    ]);
    return {
      goldCirculating: Number(goldCirc[0]?.total ?? 0),
      activeUsers: { h24: Number(activeUsers24h[0]?.count ?? 0), d7: Number(activeUsers7d[0]?.count ?? 0) },
      stealsToday: Number(stealsToday[0]?.count ?? 0),
      harvestsToday: Number(harvestsToday[0]?.count ?? 0),
    };
  }
}
