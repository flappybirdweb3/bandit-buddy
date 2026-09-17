import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { Web3Service } from './web3.service';
import { User } from '../user/entities/user.entity';

const FUSION_ABI = [
  'function nextRequestId() external view returns (uint256)',
  'function getFusionRequest(uint256 requestId) external view returns (tuple(address player, uint256 baseTierId, bool useLuckyBone, bool useCollar, bool useDivineInsurance, bool resolved, uint256 requestBlock, uint256 totalCost))',
  'function resolveFusion(uint256 requestId, bool isSuccess, uint256 shardsToReward) external',
  'event FusionRequested(uint256 indexed requestId, address indexed player, uint256 indexed baseTierId, bool useLuckyBone, bool useCollar, bool useDivineInsurance, uint256 totalCost)',
  'event FusionResolved(uint256 indexed requestId, address indexed player, bool isSuccess, uint256 upgradedTier, uint256 shardsRewarded)',
];

const BASE_SUCCESS_RATES: Record<number, number> = {
  1: 75, // T1 -> T2 (Chihuahua -> Corgi)
  2: 50, // T2 -> T3 (Corgi -> Husky)
  3: 30, // T3 -> T4 (Husky -> Rottweiler)
  4: 15, // T4 -> T5 (Rottweiler -> Doberman)
};

const FAIL_PITY_SHARDS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 8,
  4: 20,
};

export interface FusionResult {
  requestId: number;
  player: string;
  baseTierId: number;
  upgradedTier: number;
  isSuccess: boolean;
  shardsRewarded: number;
  roll: number;
  targetRate: number;
  useLuckyBone: boolean;
  useCollar: boolean;
  useDivineInsurance?: boolean;
  txHash: string;
}

@Injectable()
export class FusionOracleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FusionOracleService.name);
  private contract: ethers.Contract | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<number>();
  private lastProcessedId = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly web3Service: Web3Service,
  ) {}

  onModuleInit() {
    const gachaAddress = this.config.get<string>('web3.gachaContractAddress') ?? '';
    const adminWallet = this.web3Service.getAdminWallet();

    if (!gachaAddress || !adminWallet) {
      this.logger.warn('FusionOracleService: Gacha contract or Admin wallet not configured. Oracle disabled.');
      return;
    }

    try {
      this.contract = new ethers.Contract(gachaAddress, FUSION_ABI, adminWallet);
      this.logger.log(`FusionOracleService initialized with contract at ${gachaAddress}`);

      // Start background poller to auto-resolve any unhandled requests
      this.pollTimer = setInterval(() => {
        void this.pollUnresolvedRequests();
      }, 5000);
    } catch (err) {
      this.logger.error(`Failed to initialize FusionOracleService: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Resolve a specific fusion request.
   * Can be invoked directly from API when frontend confirms transaction, or via background poller.
   */
  async resolveFusion(requestId: number): Promise<FusionResult> {
    if (!this.contract) {
      throw new BadRequestException('Fusion Oracle is not available');
    }

    if (this.inFlight.has(requestId)) {
      // Wait for existing in-flight resolution (up to 6s)
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!this.inFlight.has(requestId)) break;
      }
    }

    this.inFlight.add(requestId);

    try {
      // 1. Fetch request state from on-chain contract with RPC replication retry
      let req: any = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          req = await this.contract.getFusionRequest(requestId);
          if (req && req.player && req.player !== ethers.ZeroAddress && Number(req.requestBlock) > 0) {
            break;
          }
        } catch {
          // Transient RPC reading issue, will retry
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!req) {
        throw new NotFoundException(`Fusion request #${requestId} not found on-chain`);
      }

      const player = req.player as string;
      const baseTierId = Number(req.baseTierId);
      const useLuckyBone = Boolean(req.useLuckyBone);
      const useCollar = Boolean(req.useCollar);
      const useDivineInsurance = Boolean(req.useDivineInsurance);
      const resolved = Boolean(req.resolved);

      if (!player || player === ethers.ZeroAddress || Number(req.requestBlock) === 0) {
        throw new NotFoundException(`Fusion request #${requestId} not found on-chain`);
      }

      if (resolved) {
        this.logger.log(`Fusion request #${requestId} was already resolved.`);
        return {
          requestId,
          player,
          baseTierId,
          upgradedTier: 0,
          isSuccess: false,
          shardsRewarded: 0,
          roll: 0,
          targetRate: 0,
          useLuckyBone,
          useCollar,
          useDivineInsurance,
          txHash: '',
        };
      }

      // 2. Cryptographically secure RNG roll (1-100)
      const randBytes = crypto.randomBytes(4);
      const roll = (randBytes.readUInt32BE(0) % 100) + 1;

      // 3. Success Matrix Calculation
      const baseRate = BASE_SUCCESS_RATES[baseTierId] ?? 15;
      const finalRate = baseRate + (useLuckyBone ? 15 : 0);
      const isSuccess = roll <= finalRate;

      // 4. Consolation Pity Shards (30 for Divine Insurance on fail)
      const shardsToReward = isSuccess
        ? 0
        : (useDivineInsurance ? 30 : (FAIL_PITY_SHARDS[baseTierId] ?? 1));

      this.logger.log(
        `[SoulForge] Resolving #${requestId}: player=${player}, tier=${baseTierId}->${baseTierId + 1}, roll=${roll}/${finalRate} (LuckyBone=${useLuckyBone}, Collar=${useCollar}, DivineInsurance=${useDivineInsurance}) => ${isSuccess ? 'SUCCESS' : 'FAIL'}`,
      );

      // 5. Submit on-chain resolution
      const tx = await this.contract.resolveFusion(requestId, isSuccess, shardsToReward, {
        gasLimit: 400000,
      });
      const receipt = await tx.wait();

      this.logger.log(
        `[SoulForge] Resolution confirmed in tx ${receipt?.hash ?? tx.hash} for request #${requestId}`,
      );

      // 6. Sync in-game DB inventory
      try {
        const user = await this.dataSource.manager.findOne(User, {
          where: { walletAddress: ethers.getAddress(player) },
        });
        if (user) {
          await this.web3Service.syncGuardDogs(user.id, user.walletAddress);
        }
      } catch (syncErr) {
        this.logger.warn(`Failed to auto-sync dogs after fusion #${requestId}: ${(syncErr as Error).message}`);
      }

      if (requestId > this.lastProcessedId) {
        this.lastProcessedId = requestId;
      }

      return {
        requestId,
        player,
        baseTierId,
        upgradedTier: isSuccess ? baseTierId + 1 : 0,
        isSuccess,
        shardsRewarded: shardsToReward,
        roll,
        targetRate: finalRate,
        useLuckyBone,
        useCollar,
        useDivineInsurance,
        txHash: tx.hash,
      };
    } finally {
      this.inFlight.delete(requestId);
    }
  }

  /**
   * Background poller that ensures all pending requests on-chain are resolved.
   */
  private async pollUnresolvedRequests() {
    if (!this.contract) return;

    try {
      const nextId = Number(await this.contract.nextRequestId());
      if (nextId <= 1) return;

      const startId = Math.max(1, this.lastProcessedId);
      for (let reqId = startId; reqId < nextId; reqId++) {
        if (this.inFlight.has(reqId)) continue;

        try {
          const req = await this.contract.getFusionRequest(reqId);
          if (req && !req.resolved && Number(req.requestBlock) > 0) {
            this.logger.log(`[SoulForge Poller] Found unhandled request #${reqId}, resolving...`);
            await this.resolveFusion(reqId);
          } else if (req && req.resolved) {
            if (reqId > this.lastProcessedId) {
              this.lastProcessedId = reqId;
            }
          }
        } catch (err) {
          this.logger.warn(`[SoulForge Poller] Error checking request #${reqId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.debug(`[SoulForge Poller] poll error: ${(err as Error).message}`);
    }
  }
}
