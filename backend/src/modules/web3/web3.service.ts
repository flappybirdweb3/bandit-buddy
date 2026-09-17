import {
  Injectable, BadRequestException, ForbiddenException, HttpException,
  HttpStatus, InternalServerErrorException, Logger, ServiceUnavailableException,
  Inject, forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { Cron } from '@nestjs/schedule';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { MarketplaceListing } from '../marketplace/entities/marketplace-listing.entity';
import { ClaimIntent } from './entities/claim-intent.entity';
import { RedisService } from '../../common/redis.service';
import { DexOracleService } from './dex-oracle.service';
import { EconomyOracleService } from './economy-oracle.service';
import { TreasuryMonitorService } from './treasury-monitor.service';
import { GuildService } from '../guild/guild.service';
import { buildClaimDigest } from './claim-digest';

export enum UserCashoutTier {
  TIER_0 = 0,
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

export const CASHOUT_TIER_PERCENTAGES: Record<UserCashoutTier, number> = {
  [UserCashoutTier.TIER_0]: 0.0,      // 0% of Global Pool
  [UserCashoutTier.TIER_1]: 0.0005,   // 0.05% of Global Pool
  [UserCashoutTier.TIER_2]: 0.0020,   // 0.20% of Global Pool
  [UserCashoutTier.TIER_3]: 0.0200,   // 2.00% of Global Pool
};

export const CASHOUT_TIER_NAMES: Record<UserCashoutTier, string> = {
  [UserCashoutTier.TIER_0]: 'Tier 0 - Unverified / Low Trust',
  [UserCashoutTier.TIER_1]: 'Tier 1 - Novice Farmer',
  [UserCashoutTier.TIER_2]: 'Tier 2 - Dedicated Farmer',
  [UserCashoutTier.TIER_3]: 'Tier 3 - Elite / Whale',
};

export interface CashoutQuotaResponse {
  date: string;
  tier: UserCashoutTier;
  tierName: string;
  tierPercentage: number;
  userDailyLimit: number;
  userSpentToday: number;
  userRemaining: number;
  globalDailyPool: number;
  globalSpentToday: number;
  globalRemaining: number;
  releaseRate: number;
  priceGrowth24h: number;
  totalCirculatingGold: number;
  goldPerFarmWithdraw: number;
  resetAtUtc: string;
  canWithdraw: boolean;
  reason?: string;
}

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
];

const DOG_DEFENSE_MAP: Record<number, { dogType: string; defensePower: number }> = {
  1: { dogType: 'Chihuahua',  defensePower: 10 },
  2: { dogType: 'Corgi',      defensePower: 20 },
  3: { dogType: 'Husky',      defensePower: 35 },
  4: { dogType: 'Rottweiler', defensePower: 50 },
  5: { dogType: 'Doberman',   defensePower: 65 },
  6: { dogType: 'Pitbull',    defensePower: 80 },
};

const TOKEN_IDS      = [1, 2, 3, 4, 5, 6];
const SOUL_SHARD_ID  = 9999;

export type NftSyncResult = {
  synced: number;
  totalNftDefense: number;
  dogs: Array<{ tokenId: number; dogType: string; defensePower: number; balance: number }>;
  shards?: number;
  unavailable?: boolean;
};

function isRpcFailure(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (
    typeof code === 'string' &&
    ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'].includes(code)
  ) {
    return true;
  }

  const message = [
    (err as Error)?.message ?? '',
    (err as { cause?: Error })?.cause?.message ?? '',
  ].join(' ');

  return /could not detect network|missing response|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|fetch failed|rate limit|timeout/i
    .test(message);
}

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private adminWallet: ethers.Wallet | null = null;
  private provider: ethers.FallbackProvider | null = null;

  /** Dynamic Peg configuration constants */
  private readonly BASE_GOLD_USD_VALUE = 0.0001; // Intrinsic value: 1 GOLD = $0.0001 USD ($1 = 10,000 GOLD)
  private readonly DEPOSIT_FEE = 0.00; // 0% fee on deposits (FARM -> GOLD)
  private readonly WITHDRAW_FEE = 0.05; // 5% protocol fee on withdrawals (GOLD -> FARM)
  private readonly MIN_TREASURY_RESERVE_FARM = 100; // Safety reserve threshold

  /** Chain id actually served by the RPC endpoints, cached after the first successful probe. */
  private resolvedChainId: bigint | undefined;

  /** Per-fetch JSON-RPC timeout, applied to every fallback endpoint. */
  private readonly rpcTimeoutMs: number;

  /** App-level ceiling for awaiting a single chain call, however many endpoints are tried. */
  private readonly rpcRequestDeadlineMs: number;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly dexOracle: DexOracleService,
    private readonly economyOracle: EconomyOracleService,
    @Inject(forwardRef(() => GuildService))
    private readonly guildService: GuildService,
    private readonly treasuryMonitor: TreasuryMonitorService,
  ) {
    this.rpcTimeoutMs = this.config.get<number>('web3.rpcTimeoutMs') ?? 5000;
    this.rpcRequestDeadlineMs = this.config.get<number>('web3.rpcRequestDeadlineMs') ?? 8000;

    const privateKey = this.config.get<string>('web3.signerPrivateKey');
    if (privateKey && privateKey.length > 0 && privateKey !== '') {
      try {
        this.provider = this._buildFallbackProvider();
        this.adminWallet = new ethers.Wallet(privateKey).connect(this.provider);
        this.logger.log(`Signer wallet: ${this.adminWallet.address}`);

        // Warm the chain-id cache OFF the request path. Signing binds block.chainid, so
        // the first authenticated claim of the process used to pay for a cold, possibly
        // slow RPC round-trip, and an unreachable node made that first request hang.
        // Fire-and-forget on purpose: a failure here only logs, and the request path
        // resolves lazily with its own hard deadline.
        void this.resolveChainId().catch((err) =>
          this.logger.warn(`Chain id pre-resolution failed: ${(err as Error).message}`),
        );
      } catch {
        this.logger.warn('Failed to initialize admin wallet - Web3 features disabled');
      }
    }
  }

  getAdminWallet(): ethers.Wallet | null {
    return this.adminWallet;
  }

  getProvider(): ethers.JsonRpcProvider | ethers.FallbackProvider | null {
    return this.provider;
  }

  /**
   * Hard deadline around an arbitrary promise.
   *
   * `Promise.race` cannot cancel the losing branch, but every losing branch we race
   * here is an ethers fetch that already aborts on `FetchRequest.timeout` — so no
   * socket is left open. This is the last line of defence that guarantees a request
   * settles instead of becoming a proxy-level 504.
   */
  private async withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} timed out after ${ms}ms`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Build one JSON-RPC endpoint with an explicit per-request timeout.
   *
   * Without `FetchRequest.timeout`, an unreachable node leaves JsonRpcProvider
   * retrying network detection indefinitely ("failed to detect network ... retry in
   * 1s"), which is exactly how a hung claim turns into a gateway 504.
   */
  private _buildJsonRpcProvider(url: string, chainId?: number): ethers.JsonRpcProvider {
    const request = new ethers.FetchRequest(url);
    request.timeout = this.rpcTimeoutMs;
    const network = chainId ? ethers.Network.from(chainId) : undefined;
    return new ethers.JsonRpcProvider(request, network, { polling: false, staticNetwork: network });
  }

  /** #44: Ethers.js v6 FallbackProvider with ordered RPC endpoints. */
  private _buildFallbackProvider(): ethers.FallbackProvider {
    const chainId = this.config.get<number>('web3.chainId') ?? 56;

    const defaultPrimary = chainId === 97
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545/'
      : 'https://bsc-dataseed1.binance.org/';
    const primary = this.config.get<string>('web3.bscRpcUrl') ?? defaultPrimary;

    const fallbacks = chainId === 97
      ? ['https://bsc-testnet.publicnode.com', 'https://data-seed-prebsc-2-s1.binance.org:8545/']
      : ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'];

    const uniqueUrls = Array.from(new Set([primary, ...fallbacks]));
    const networks = uniqueUrls.map((url, i) => ({
      provider: this._buildJsonRpcProvider(url, chainId),
      priority: i + 1,
      stallTimeout: this.rpcTimeoutMs,
      weight: 1,
    }));
    return new ethers.FallbackProvider(networks, chainId ? ethers.Network.from(chainId) : undefined, { quorum: 1 });
  }

  /**
   * Resolve the chain id the RPC endpoints are actually serving, once per process.
   *
   * Every claim signature binds this value (FarmTokenClaim.hashMessage() uses
   * block.chainid), so reading it from the live node — not from config — is what keeps
   * backend and contract in agreement. Config is used only as a sanity check: a mismatch
   * means BSC_CHAIN_ID and BSC_RPC_URL point at different networks, which would produce
   * signatures the intended contract can never accept.
   *
   * ethers caches the network after the first successful probe, so this is one RPC call
   * per process lifetime, not one per claim. Transport failures propagate as-is so the
   * caller can decide how to degrade.
   */
  private async resolveChainId(): Promise<bigint> {
    // Fast path: the chain id of a live deployment cannot change, so the cached value
    // is authoritative for the process lifetime. This is what keeps a warm claim at
    // zero RPC calls, and therefore immune to a flapping node.
    if (this.resolvedChainId !== undefined) return this.resolvedChainId;

    // Wrapped so a dead node fails fast instead of retrying network detection forever.
    const network = await this.withDeadline(
      this.provider!.getNetwork(),
      this.rpcRequestDeadlineMs,
      'getNetwork()',
    );
    const rpcChainId = BigInt(network.chainId);

    this.resolvedChainId = rpcChainId;

    const configuredChainId = Number(this.config.get<number>('web3.chainId'));
    if (Number.isFinite(configuredChainId) && BigInt(configuredChainId) !== rpcChainId) {
      this.logger.error(
        `Chain id mismatch: web3.chainId=${configuredChainId} but the RPC reports ${rpcChainId}. ` +
          `Signatures bind the RPC chain id — set BSC_CHAIN_ID=${rpcChainId} and point ` +
          `BSC_RPC_URL at the same network to avoid mixed-chain reads.`,
      );
    }

    return this.resolvedChainId;
  }

  async generateClaimSignature(user: User, amountToClaim: number) {
    const minTrustScore = (this.config.get<number>('game.minTrustScore')) ?? 30;

    if (user.trustScore < minTrustScore) {
      throw new ForbiddenException(
        `Account flagged as bot. Trust score ${user.trustScore} < ${minTrustScore}`,
      );
    }

    // Cheap, local, specific checks first — they must answer before any infrastructure
    // call, so a remote outage cannot mask a genuine 400.
    if (!user.walletAddress) {
      throw new BadRequestException('No wallet address linked. Please link your BSC wallet first.');
    }

    if (Number(user.goldBalance) < amountToClaim) {
      throw new BadRequestException(
        `Insufficient GOLD. Have ${user.goldBalance}, need ${amountToClaim}`,
      );
    }

    const rates = await this.getDynamicRates();

    if (rates.killSwitchActive) {
      throw new ServiceUnavailableException(
        rates.killSwitchReason ?? 'Claiming paused due to high market volatility. Try again later.',
      );
    }

    const farmPayout = amountToClaim * rates.withdrawRate;
    if (farmPayout < 1.0) {
      const minGold = Math.ceil(1.0 / rates.withdrawRate);
      throw new BadRequestException(
        `Minimum withdrawal is 1 $FARM (requires at least ${minGold} GOLD at current rate).`,
      );
    }

    if (farmPayout > 100_000) {
      throw new BadRequestException('Maximum withdrawal per transaction is 100,000 $FARM.');
    }

    if (rates.treasuryFarmBalance < farmPayout) {
      throw new ServiceUnavailableException('Treasury reserve is protecting liquidity. Please try a smaller amount or wait.');
    }

    // ── Dual-Layer Protection: Global Daily Drip-Feed & User Tier Daily Quota ──
    const quota = await this.getCashoutQuota(user);

    if (quota.tier === UserCashoutTier.TIER_0) {
      throw new ForbiddenException(
        quota.reason ?? 'Account not eligible for cashout (Tier 0). Link wallet and build trust score to unlock.',
      );
    }

    if (farmPayout > quota.globalRemaining) {
      throw new HttpException(
        `Global daily cashout pool reached today's limit (${quota.globalSpentToday.toFixed(1)} / ${quota.globalDailyPool.toFixed(1)} FARM). Resets at 00:00 UTC.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (farmPayout > quota.userRemaining) {
      throw new HttpException(
        `Withdrawal exceeds your daily cashout limit (${quota.userSpentToday.toFixed(1)} / ${quota.userDailyLimit.toFixed(1)} FARM for ${quota.tierName}). Resets at 00:00 UTC.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.adminWallet) {
      throw new InternalServerErrorException('Signing service not configured');
    }

    const claimContract = this.config.get<string>('web3.claimContractAddress') ?? '';
    if (!ethers.isAddress(claimContract)) {
      throw new InternalServerErrorException(
        'Claim contract address not configured (CLAIM_CONTRACT_ADDRESS)',
      );
    }

    // Reads the live chain id; a transient node outage here is a 503, never a 500.
    let rpcChainId: bigint;
    try {
      rpcChainId = await this.resolveChainId();
    } catch (err) {
      this.logger.warn(`Cannot resolve chain id: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Blockchain network unavailable — please retry shortly',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`SET LOCAL lock_timeout = '3000ms'`);

      const lockedUser = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: user.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedUser) throw new BadRequestException('User not found');
      if (Number(lockedUser.goldBalance) < amountToClaim) {
        throw new BadRequestException('Insufficient GOLD (concurrent request detected)');
      }

      const currentNonce = lockedUser.nonce;

      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({
          goldBalance: () => `"gold_balance" - ${amountToClaim}`,
          nonce: () => '"nonce" + 1',
        })
        .where('id = :id', { id: user.id })
        .execute();

      const amountWei = ethers.parseUnits(farmPayout.toFixed(18), 18);

      const walletAddress = lockedUser.walletAddress;
      if (!walletAddress) {
        throw new BadRequestException(
          'No wallet address linked. Please link your BSC wallet first.',
        );
      }

      // Must match FarmTokenClaim.hashMessage() byte for byte — see claim-digest.spec.ts.
      const messageHash = buildClaimDigest(
        rpcChainId,
        claimContract,
        walletAddress,
        amountWei,
        currentNonce,
      );
      const signature = await this.adminWallet.signMessage(ethers.getBytes(messageHash));

      // Record intent for potential refund — upsert so re-claiming after a refund never conflicts
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(ClaimIntent)
        .values({
          userId: user.id,
          nonce: currentNonce,
          walletAddress: user.walletAddress!,
          amountGold: amountToClaim.toString(),
          amountWei: amountWei.toString(),
          status: 'pending',
        })
        .orUpdate(['wallet_address', 'amount_gold', 'amount_wei', 'status'], ['user_id', 'nonce'])
        .execute();

      // Record gold burn in gold_transactions for economy oracle
      await this.economyOracle.record(queryRunner, {
        userId: user.id,
        amount: amountToClaim,
        type: 'BURN',
        category: 'CLAIM_WITHDRAW',
        description: `Convert ${amountToClaim} GOLD to ${farmPayout.toFixed(4)} FARM (rate: ${rates.goldPerFarmWithdraw.toFixed(2)} G/FARM, alpha: ${rates.alpha})`,
      });

      await queryRunner.commitTransaction();

      // Atomically track spent daily quotas in Redis (48h TTL)
      const todayUtc = new Date().toISOString().slice(0, 10);
      const CASHOUT_KEY_TTL = 172800; // 48h
      await Promise.all([
        this.redis.incrByFloat(`cashout:global:${todayUtc}`, farmPayout, CASHOUT_KEY_TTL),
        this.redis.incrByFloat(`cashout:user:${user.id}:${todayUtc}`, farmPayout, CASHOUT_KEY_TTL),
      ]);

      this.logger.log(`Claim signature: user=${user.id} amountGold=${amountToClaim} farmPayout=${farmPayout.toFixed(4)} nonce=${currentNonce}`);

      return {
        userAddress: walletAddress,
        amountWei: amountWei.toString(),
        nonce: currentNonce,
        signature,
        farmAmount: Number(farmPayout.toFixed(6)),
        goldBurned: amountToClaim,
        rate: rates.goldPerFarmWithdraw,
        alpha: rates.alpha,
        tier: quota.tier,
        remainingDailyQuota: Math.max(0, Number((quota.userRemaining - farmPayout).toFixed(2))),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // Domain verdicts (400 insufficient gold, 403 low trust, 503 kill switch) keep
      // their own status and message.
      if (err instanceof HttpException) throw err;

      // Row-lock timeout (SQLSTATE 55P03 from SET LOCAL lock_timeout above). The account
      // is momentarily busy, not broken — say so instead of surfacing a generic 500.
      if ((err as { code?: string })?.code === '55P03') {
        this.logger.warn(`Claim signature blocked on row lock for user ${user.id}`);
        throw new ServiceUnavailableException(
          'Your account is busy processing another action — please retry in a moment.',
        );
      }

      // Transport failure (node down / timeout / rate limit). Operational condition,
      // not a defect: answer 503 with an actionable message rather than letting the
      // request hang until the reverse proxy emits a 504.
      if (isRpcFailure(err)) {
        this.logger.warn(`Claim signature failed on RPC transport: ${(err as Error).message}`);
        throw new ServiceUnavailableException(
          'Blockchain network is busy — please try again in a moment.',
        );
      }

      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async refundClaim(userId: string, nonce: number, unbroadcasted = false) {
    const intent = await this.dataSource.manager.findOne(ClaimIntent, {
      where: { userId, nonce, status: 'pending' },
    });

    if (!intent) {
      throw new BadRequestException('No pending claim found for this nonce — already refunded or completed.');
    }

    // Cooldown check to prevent race with pending mempool transactions.
    // When unbroadcasted is true (e.g. simulation failed, user cancelled before send),
    // or on testnet, refund is immediate.
    const isTestnet = this.config.get<boolean>('web3.isTestnet') ?? true;
    const defaultCooldown = isTestnet ? 0 : 15;
    const refundCooldownSec = unbroadcasted
      ? 0
      : (this.config.get<number>('web3.claimRefundCooldownSec') ?? defaultCooldown);

    const elapsedSec = Math.floor((Date.now() - new Date(intent.createdAt).getTime()) / 1000);
    if (!unbroadcasted && elapsedSec < refundCooldownSec) {
      const remainingSec = refundCooldownSec - elapsedSec;
      throw new BadRequestException(
        `Claim intent was submitted recently. Please wait ${remainingSec} more second${remainingSec !== 1 ? 's' : ''} to allow pending blockchain transactions to settle before requesting a refund.`,
      );
    }

    // Confirming the nonce is STILL unused on-chain is the ONLY thing that stops a
    // double-spend: a refund credits GOLD, so if the claim tx later confirms the player
    // holds both the GOLD and the FARM. It therefore FAILS CLOSED — an unverifiable
    // state is not permission to pay out. (It used to proceed with the refund when the
    // RPC errored, which is exactly the condition a flapping node produces.)
    const claimContractAddress = this.config.get<string>('web3.claimContractAddress') ?? '';
    if (!this.provider || !ethers.isAddress(claimContractAddress)) {
      throw new ServiceUnavailableException(
        'Cannot verify claim status on-chain right now — please retry the refund in a moment.',
      );
    }

    let nonceUsed: boolean;
    try {
      const contract = new ethers.Contract(
        claimContractAddress,
        ['function isNonceUsed(address,uint256) external view returns (bool)'],
        this.provider,
      );
      nonceUsed = await this.withDeadline(
        contract.isNonceUsed(intent.walletAddress, nonce) as Promise<boolean>,
        this.rpcRequestDeadlineMs,
        'isNonceUsed()',
      );
    } catch (err) {
      this.logger.warn(
        `Refund blocked — could not verify nonce ${nonce} on-chain: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Blockchain network is unavailable — please retry the refund in a moment.',
      );
    }

    if (nonceUsed) {
      await this.dataSource.manager.update(ClaimIntent, { id: intent.id }, { status: 'completed' });
      throw new BadRequestException('Claim was already confirmed on-chain — no refund needed.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Re-verify and lock the intent inside the transaction to prevent concurrent double-refunds
      const lockedIntent = await queryRunner.manager
        .createQueryBuilder(ClaimIntent, 'ci')
        .where('ci.id = :id AND ci.status = :status', { id: intent.id, status: 'pending' })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedIntent) {
        throw new BadRequestException('Claim already processed or refunded.');
      }

      const amount = Number(lockedIntent.amountGold);
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({ goldBalance: () => `"gold_balance" + ${amount}` })
        .where('id = :id', { id: userId })
        .execute();

      await queryRunner.manager.update(ClaimIntent, { id: lockedIntent.id }, { status: 'refunded' });
      await queryRunner.commitTransaction();

      // Rollback daily cashout quota in Redis
      try {
        const farmRefunded = Number(ethers.formatUnits(lockedIntent.amountWei, 18));
        if (farmRefunded > 0) {
          const intentDate = new Date(lockedIntent.createdAt).toISOString().slice(0, 10);
          await Promise.all([
            this.redis.decrByFloat(`cashout:global:${intentDate}`, farmRefunded),
            this.redis.decrByFloat(`cashout:user:${userId}:${intentDate}`, farmRefunded),
          ]);
        }
      } catch (redisErr) {
        this.logger.warn(`Failed to rollback cashout quota on refund: ${(redisErr as Error).message}`);
      }

      this.logger.log(`Claim refunded: user=${userId} nonce=${nonce} gold=+${amount}`);
      return { refunded: true, goldRestored: amount };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async refundAllPendingClaims(userId: string) {
    const pendingIntents = await this.dataSource.manager.find(ClaimIntent, {
      where: { userId, status: 'pending' },
      order: { nonce: 'ASC' },
    });

    if (!pendingIntents || pendingIntents.length === 0) {
      return { refundedCount: 0, totalGoldRestored: 0 };
    }

    const claimContractAddress = this.config.get<string>('web3.claimContractAddress') ?? '';
    let contract: ethers.Contract | null = null;
    if (this.provider && ethers.isAddress(claimContractAddress)) {
      contract = new ethers.Contract(
        claimContractAddress,
        ['function isNonceUsed(address,uint256) external view returns (bool)'],
        this.provider,
      );
    }

    let totalGoldRestored = 0;
    let refundedCount = 0;

    for (const intent of pendingIntents) {
      let nonceUsed = false;
      if (contract) {
        try {
          nonceUsed = await this.withDeadline(
            contract.isNonceUsed(intent.walletAddress, intent.nonce) as Promise<boolean>,
            this.rpcRequestDeadlineMs,
            'isNonceUsed()',
          );
        } catch (err) {
          this.logger.warn(`Could not verify nonce ${intent.nonce} on-chain for batch refund: ${(err as Error).message}`);
          continue;
        }
      }

      if (nonceUsed) {
        await this.dataSource.manager.update(ClaimIntent, { id: intent.id }, { status: 'completed' });
        continue;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');
      try {
        const lockedIntent = await queryRunner.manager
          .createQueryBuilder(ClaimIntent, 'ci')
          .where('ci.id = :id AND ci.status = :status', { id: intent.id, status: 'pending' })
          .setLock('pessimistic_write')
          .getOne();

        if (lockedIntent) {
          const amount = Number(lockedIntent.amountGold);
          await queryRunner.manager
            .createQueryBuilder()
            .update(User)
            .set({ goldBalance: () => `"gold_balance" + ${amount}` })
            .where('id = :id', { id: userId })
            .execute();

          await queryRunner.manager.update(ClaimIntent, { id: lockedIntent.id }, { status: 'refunded' });
          totalGoldRestored += amount;
          refundedCount++;

          // Rollback daily cashout quota in Redis
          try {
            const farmRefunded = Number(ethers.formatUnits(lockedIntent.amountWei, 18));
            if (farmRefunded > 0) {
              const intentDate = new Date(lockedIntent.createdAt).toISOString().slice(0, 10);
              await Promise.all([
                this.redis.decrByFloat(`cashout:global:${intentDate}`, farmRefunded),
                this.redis.decrByFloat(`cashout:user:${userId}:${intentDate}`, farmRefunded),
              ]);
            }
          } catch {
            // Redis error should not block refund
          }
        }
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }
    }

    if (totalGoldRestored > 0) {
      this.logger.log(`Batch refunded ${refundedCount} pending claims for user=${userId}: +${totalGoldRestored} GOLD`);
    }

    return { refundedCount, totalGoldRestored };
  }

  async getShopDogs(userId: string) {
    const dogs = await this.dataSource.manager.find(NftGuardDog, {
      where: { ownerId: userId, source: 'shop', isActive: true },
      order: { defensePower: 'DESC' },
    });
    return dogs.map((d) => ({
      id: d.id,
      dogType: d.dogType,
      defensePower: d.defensePower,
    }));
  }

  async tokenizeDog(user: User, count: number) {
    if (count !== 1 && count !== 3) {
      throw new BadRequestException('count must be 1 or 3');
    }

    if (!user.walletAddress) {
      throw new BadRequestException('No wallet address linked. Please link your BSC wallet first.');
    }

    if (!this.adminWallet) {
      throw new InternalServerErrorException('Signing service not configured');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock user row to prevent concurrent tokenize
      const lockedUser = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: user.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedUser) throw new BadRequestException('User not found');

      // Find owned shop dogs
      const shopDogs = await queryRunner.manager.find(NftGuardDog, {
        where: { ownerId: user.id, source: 'shop', isActive: true },
      });

      if (shopDogs.length < count) {
        throw new BadRequestException(
          `Need ${count} shop dog(s) to tokenize, but only have ${shopDogs.length}.`,
        );
      }

      // Mark shop dog(s) as tokenized (delete the in-game records)
      const toTokenize = shopDogs.slice(0, count);
      await queryRunner.manager.delete(
        NftGuardDog,
        toTokenize.map((d) => d.id),
      );

      // Use nonce as a unique identifier for this tokenization (reuse user nonce counter)
      const currentNonce = lockedUser.nonce;
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({ nonce: () => '"nonce" + 1' })
        .where('id = :id', { id: user.id })
        .execute();

      // Sign: keccak256(abi.encodePacked(walletAddress, count, nonce))
      // Matches the on-chain: keccak256(abi.encodePacked(msg.sender, count, nonce))
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256'],
        [user.walletAddress, count, currentNonce],
      );
      const signature = await this.adminWallet.signMessage(ethers.getBytes(messageHash));

      await queryRunner.commitTransaction();

      this.logger.log(`Tokenize dog: user=${user.id} count=${count} nonce=${currentNonce}`);

      return {
        walletAddress: user.walletAddress,
        count,
        nonce: currentNonce,
        signature,
        contractAddress: this.config.get<string>('web3.gachaContractAddress') ?? '',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rollbackTokenizeDog(user: User, nonce: number, count = 1) {
    if (!user.walletAddress) throw new BadRequestException('No wallet linked');

    // 1. Verify on-chain that this nonce was NOT used
    const fusionAddr = this.config.get<string>('web3.gachaContractAddress');
    if (fusionAddr) {
      try {
        const provider = this.getProvider();
        const fusionAbi = ['function usedTokenizeNonces(bytes32) view returns (bool)'];
        const fusion = new ethers.Contract(fusionAddr, fusionAbi, provider);
        const nonceKey = ethers.solidityPackedKeccak256(['address', 'uint256'], [user.walletAddress, nonce]);
        const used = await fusion.usedTokenizeNonces(nonceKey);
        if (used) {
          throw new BadRequestException('This tokenization was already completed on-chain.');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Could not verify onchain nonce ${nonce}: ${err.message}`);
      }
    }

    // 2. Restore the dog in database
    const toRestore = count === 3 ? 3 : 1;
    for (let i = 0; i < toRestore; i++) {
      await this.dataSource.manager.insert(NftGuardDog, {
        ownerId: user.id,
        tokenId: 0,
        dogType: 'dog_stray',
        defensePower: 10,
        isActive: true,
        isGuarding: true,
        source: 'shop',
        lastFedAt: new Date(),
      });
    }

    this.logger.log(`Rollback tokenize dog: restored ${toRestore} stray dog(s) for user=${user.id}`);
    return { restored: true, count: toRestore };
  }

  async redeemShards(user: User, count: number) {
    if (count < 1 || count > 10) {
      throw new BadRequestException('count must be between 1 and 10');
    }

    if (!user.walletAddress) {
      throw new BadRequestException('No wallet address linked. Please link your BSC wallet first.');
    }

    if (!this.adminWallet) {
      throw new InternalServerErrorException('Signing service not configured');
    }

    const shardsNeeded = count * 100;

    // Check user's soul shard balance from user_items
    const shardItem = await this.dataSource.manager.query(
      `SELECT quantity FROM user_items WHERE user_id = $1 AND item_type = 'soul_shard'`,
      [user.id],
    );
    const currentShards = shardItem && shardItem.length > 0 ? Number(shardItem[0].quantity) : 0;

    if (currentShards < shardsNeeded) {
      throw new BadRequestException(
        `Need ${shardsNeeded} Soul Shards to redeem, but currently have ${currentShards}.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedUser = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: user.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedUser) throw new BadRequestException('User not found');

      const currentNonce = lockedUser.nonce;
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({ nonce: () => '"nonce" + 1' })
        .where('id = :id', { id: user.id })
        .execute();

      // Sign: keccak256(abi.encodePacked("redeem", msg.sender, count, nonce))
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256', 'uint256'],
        ['redeem', user.walletAddress, count, currentNonce],
      );
      const signature = await this.adminWallet.signMessage(ethers.getBytes(messageHash));

      await queryRunner.commitTransaction();

      this.logger.log(`Redeem shards: user=${user.id} count=${count} nonce=${currentNonce}`);

      return {
        walletAddress: user.walletAddress,
        count,
        nonce: currentNonce,
        signature,
        contractAddress: this.config.get<string>('web3.gachaContractAddress') ?? '',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async markClaimCompleted(userId: string, nonce: number) {
    await this.dataSource.manager.update(
      ClaimIntent,
      { userId, nonce, status: 'pending' },
      { status: 'completed' },
    ).catch(() => {}); // best-effort
  }

  async syncGuardDogs(userId: string, walletAddress: string): Promise<NftSyncResult> {
    if (!this.provider) {
      this.logger.warn('Web3 provider not configured - skipping NFT sync');
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }

    const nftContractAddress = this.config.get<string>('web3.nftContractAddress') ?? '';
    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') {
      this.logger.warn('NFT contract address not configured');
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }

    // Stage 1 — chain read. Isolated from the DB work below on purpose: a node outage is
    // an expected operational condition that must degrade to "last known state" (this is
    // a refresh endpoint), while a genuine DB failure must stay visible rather than being
    // reported as "you own no dogs".
    let balances: bigint[];
    try {
      // Single RPC call: 6 dog breeds + Soul Shards (ID 9999)
      const contract = new ethers.Contract(nftContractAddress, ERC1155_ABI, this.provider);
      const allTokenIds = [...TOKEN_IDS, SOUL_SHARD_ID];
      const accounts = allTokenIds.map(() => walletAddress);
      balances = await contract.balanceOfBatch(accounts, allTokenIds);
    } catch (err) {
      if (!isRpcFailure(err)) throw err;
      this.logger.warn(
        `NFT sync skipped — RPC unavailable for ${walletAddress}: ${(err as Error).message}`,
      );
      return { synced: 0, totalNftDefense: 0, dogs: [], unavailable: true };
    }

    // Stage 2 — persist what the chain reported. Errors here are ours and must surface.
    try {
      const shardBalance = Number(balances[TOKEN_IDS.length]); // index 6 = soul shard

      const ownedDogs = TOKEN_IDS
        .map((tokenId, idx) => ({ tokenId, balance: Number(balances[idx]) }))
        .filter(({ balance }) => balance > 0)
        .map(({ tokenId, balance }) => ({
          tokenId,
          balance,
          dogType: DOG_DEFENSE_MAP[tokenId].dogType,
          defensePower: DOG_DEFENSE_MAP[tokenId].defensePower,
        }));

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Only deactivate NFT-sourced dogs — shop dogs (source='shop') are NOT touched
        await queryRunner.manager.update(
          NftGuardDog,
          { ownerId: userId, source: 'nft' },
          { isActive: false, listingId: null },
        );

        for (const dog of ownedDogs) {
          const existingDogs = await queryRunner.manager.find(NftGuardDog, {
            where: { ownerId: userId, tokenId: dog.tokenId, source: 'nft' },
            order: { id: 'ASC' },
          });

          // Activate existing records up to dog.balance
          const toUpdateCount = Math.min(existingDogs.length, dog.balance);
          for (let i = 0; i < toUpdateCount; i++) {
            await queryRunner.manager.update(NftGuardDog, { id: existingDogs[i].id }, {
              isActive: true,
              defensePower: dog.defensePower,
              dogType: dog.dogType,
            });
          }

          // If user owns MORE on-chain than existing DB records, insert the additional dogs
          if (dog.balance > existingDogs.length) {
            const needed = dog.balance - existingDogs.length;
            for (let i = 0; i < needed; i++) {
              await queryRunner.manager.insert(NftGuardDog, {
                ownerId: userId,
                tokenId: dog.tokenId,
                dogType: dog.dogType,
                defensePower: dog.defensePower,
                isActive: true,
                // Default first dog to guarding if none were existing; extra dogs default to storage (isGuarding: false)
                isGuarding: existingDogs.length === 0 && i === 0,
                source: 'nft',
              });
            }
          }

          // Reconcile marketplace listings for this tokenId (auto-cancel surplus if dogs were burned/fused/sold)
          const activeListings = await queryRunner.manager.find(MarketplaceListing, {
            where: { sellerId: userId, tokenId: dog.tokenId, assetType: 'nft', status: 'active' },
            order: { createdAt: 'DESC' },
          });
          if (activeListings.length > dog.balance) {
            const surplus = activeListings.slice(0, activeListings.length - dog.balance);
            for (const l of surplus) {
              await queryRunner.manager.update(MarketplaceListing, { id: l.id }, { status: 'cancelled' });
            }
          }

          // Link remaining active listings 1-to-1 to active dogs
          const remainingListings = await queryRunner.manager.find(MarketplaceListing, {
            where: { sellerId: userId, tokenId: dog.tokenId, assetType: 'nft', status: 'active' },
            order: { createdAt: 'ASC' },
          });
          const activeDogs = await queryRunner.manager.find(NftGuardDog, {
            where: { ownerId: userId, tokenId: dog.tokenId, source: 'nft', isActive: true },
            order: { isGuarding: 'ASC', id: 'ASC' },
          });

          for (let i = 0; i < activeDogs.length; i++) {
            const d = activeDogs[i];
            const listing = remainingListings[i];
            if (listing) {
              // Mutual exclusivity: Listed dog CANNOT guard farm
              await queryRunner.manager.update(NftGuardDog, { id: d.id }, {
                listingId: listing.id,
                isGuarding: false,
              });
            } else {
              await queryRunner.manager.update(NftGuardDog, { id: d.id }, {
                listingId: null,
              });
            }
          }
        }

        // Cancel any active marketplace listings for tokens user no longer holds
        const validTokenIds = ownedDogs.filter((d) => d.balance > 0).map((d) => d.tokenId);
        const orphanListingsQb = queryRunner.manager
          .createQueryBuilder(MarketplaceListing, 'l')
          .where('l.seller_id = :userId AND l.asset_type = :assetType AND l.status = :status', {
            userId,
            assetType: 'nft',
            status: 'active',
          });
        if (validTokenIds.length > 0) {
          orphanListingsQb.andWhere('l.token_id NOT IN (:...validTokenIds)', { validTokenIds });
        }
        const orphanListings = await orphanListingsQb.getMany();
        for (const l of orphanListings) {
          await queryRunner.manager.update(MarketplaceListing, { id: l.id }, { status: 'cancelled' });
        }

        // Sync soul shard balance → user_items table (upsert exact on-chain count)
        if (shardBalance > 0) {
          await queryRunner.manager.query(
            `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
             VALUES ($1, 'soul_shard', $2, 0)
             ON CONFLICT (user_id, item_type)
             DO UPDATE SET quantity = $2`,
            [userId, shardBalance],
          );
        } else {
          await queryRunner.manager.query(
            `UPDATE user_items SET quantity = 0 WHERE user_id = $1 AND item_type = 'soul_shard'`,
            [userId],
          );
        }

        await queryRunner.commitTransaction();

        const allActiveGuarding = await this.dataSource.manager.find(NftGuardDog, {
          where: { ownerId: userId, isActive: true, isGuarding: true },
        });
        const totalNftDefense = allActiveGuarding.reduce((sum, d) => sum + d.defensePower, 0);

        const totalActiveDogs = await this.dataSource.manager.find(NftGuardDog, {
          where: { ownerId: userId, isActive: true, source: 'nft' },
        });

        this.logger.log(
          `NFT sync: user=${userId} dogs=${totalActiveDogs.length} defense=${totalNftDefense} shards=${shardBalance}`,
        );

        return { synced: totalActiveDogs.length, totalNftDefense, dogs: ownedDogs, shards: shardBalance };
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      this.logger.error(`NFT sync failed for ${walletAddress}: ${(err as Error).message}`);
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }
  }

  async getNftStatus(userId: string) {
    // Return ALL dogs in wallet (is_active=true) so Storage UI can show guarding vs stored
    const dogs = await this.dataSource.manager.find(NftGuardDog, {
      where: { ownerId: userId, source: 'nft', isActive: true },
      order: { defensePower: 'DESC' },
    });

    const activeListings = await this.dataSource.manager.find(MarketplaceListing, {
      where: { sellerId: userId, assetType: 'nft', status: 'active' },
    });

    const ownedBreeds = dogs.map((d) => {
      const isListed = !!d.listingId || activeListings.some((l) => l.tokenId === d.tokenId && l.id === d.listingId);
      return {
        id: d.id,
        tokenId: d.tokenId,
        dogType: d.dogType,
        defensePower: d.defensePower,
        isGuarding: d.isGuarding,
        listingId: d.listingId ?? null,
        isListed,
      };
    });

    const guardingDogs = dogs.filter((d) => d.isGuarding);

    const tierStats: Record<number, {
      total: number;
      guarding: number;
      listed: number;
      available: number;
      canFuse: boolean;
    }> = {};

    for (let t = 1; t <= 4; t++) {
      const tierDogs = dogs.filter((d) => d.tokenId === t);
      const total = tierDogs.length;
      const guarding = tierDogs.filter((d) => d.isGuarding).length;
      const activeListingsForTier = activeListings.filter((l) => l.tokenId === t).length;
      const dbListedForTier = tierDogs.filter((d) => !!d.listingId).length;
      const listed = Math.max(dbListedForTier, activeListingsForTier);
      const available = Math.max(0, total - guarding - listed);
      tierStats[t] = {
        total,
        guarding,
        listed,
        available,
        canFuse: available >= 3,
      };
    }

    const shardItem = await this.dataSource.manager.query(
      `SELECT quantity FROM user_items WHERE user_id = $1 AND item_type = 'soul_shard'`,
      [userId],
    );
    const soulShards = shardItem && shardItem.length > 0 ? Number(shardItem[0].quantity) : 0;

    return {
      ownedBreeds,
      tierStats,
      totalNftDefense: guardingDogs.reduce((sum, d) => sum + d.defensePower, 0),
      breedCount: dogs.length,
      soulShards,
    };
  }

  async checkFusionEligibility(userId: string, baseTierId: number) {
    if (baseTierId < 1 || baseTierId > 4) {
      throw new BadRequestException('Invalid dog tier for fusion (must be 1-4)');
    }

    const status = await this.getNftStatus(userId);
    const stat = status.tierStats?.[baseTierId];
    const dogName = DOG_DEFENSE_MAP[baseTierId]?.dogType || `Tier ${baseTierId}`;

    if (!stat || stat.available < 3) {
      if (stat && stat.listed > 0 && stat.available < 3) {
        throw new BadRequestException({
          error: 'DOGS_LISTED_ON_MARKET',
          message: `Cannot fuse: ${stat.listed} of your ${dogName}s are currently listed on the Marketplace. Please cancel your listing in Marketplace before fusing.`,
          tierStats: stat,
        });
      }
      if (stat && stat.guarding > 0 && stat.available < 3) {
        throw new BadRequestException({
          error: 'DOGS_GUARDING_FARM',
          message: `Cannot fuse: ${stat.guarding} of your ${dogName}s are currently guarding your farm. Please recall them to Storage before fusing.`,
          tierStats: stat,
        });
      }
      throw new BadRequestException({
        error: 'INSUFFICIENT_AVAILABLE_DOGS',
        message: `Cannot fuse: You need at least 3 available ${dogName}s in storage, but only have ${stat?.available ?? 0}.`,
        tierStats: stat,
      });
    }

    return { eligible: true, baseTierId, available: stat.available, tierStats: stat };
  }

  async setDogGuarding(userId: string, tokenId: number, isGuarding: boolean) {
    const dog = await this.dataSource.manager.findOne(NftGuardDog, {
      where: { ownerId: userId, tokenId, source: 'nft', isActive: true },
    });
    if (!dog) throw new BadRequestException('Guard dog not found in your wallet');

    if (isGuarding && dog.listingId) {
      throw new BadRequestException(
        'This dog is currently listed for sale on the Marketplace. Cancel the listing before deploying it to guard your farm.',
      );
    }

    await this.dataSource.manager.update(NftGuardDog, { id: dog.id }, { isGuarding });
    this.logger.log(`Dog guarding toggle: user=${userId} tokenId=${tokenId} isGuarding=${isGuarding}`);
    return { tokenId, isGuarding, message: isGuarding ? 'Dog is now guarding your farm' : 'Dog moved to storage' };
  }

  /** Toggle guarding by UUID — works for both shop and NFT dogs. */
  async setDogGuardingById(userId: string, dogId: string, isGuarding: boolean) {
    const dog = await this.dataSource.manager.findOne(NftGuardDog, {
      where: { id: dogId, ownerId: userId, isActive: true },
    });
    if (!dog) throw new BadRequestException('Guard dog not found');

    if (isGuarding && dog.listingId) {
      throw new BadRequestException(
        'This dog is currently listed for sale on the Marketplace. Cancel the listing before deploying it to guard your farm.',
      );
    }

    await this.dataSource.manager.update(NftGuardDog, { id: dogId }, { isGuarding });
    this.logger.log(`Dog guarding by id: user=${userId} dogId=${dogId} isGuarding=${isGuarding}`);
    return { dogId, dogType: dog.dogType, isGuarding, message: isGuarding ? 'Dog is now guarding your farm' : 'Dog moved to storage' };
  }

  // ── Dog Feeding (#55) ────────────────────────────────────────────

  async feedDog(userId: string, dogId: string) {
    const FEED_COST = 10; // 10 GOLD per feeding
    const FEED_COOLDOWN_HOURS = 23; // prevents spam-feeding

    return this.dataSource.transaction(async (manager) => {
      const dog = await manager.findOne(NftGuardDog, {
        where: { id: dogId, ownerId: userId, isActive: true },
      });
      if (!dog) throw new BadRequestException('Guard dog not found');

      const fedTime = dog.lastFedAt ? new Date(dog.lastFedAt).getTime() : 0;
      const hoursSinceFed = fedTime > 0 ? (Date.now() - fedTime) / 3_600_000 : 999;
      if (hoursSinceFed < FEED_COOLDOWN_HOURS) {
        const nextFeedHours = Math.ceil(FEED_COOLDOWN_HOURS - hoursSinceFed);
        throw new BadRequestException(`Dog already fed. Next feeding in ${nextFeedHours}h`);
      }

      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');
      if (user.goldBalance < FEED_COST) throw new BadRequestException(`Not enough gold. Need ${FEED_COST}G`);

      await manager.decrement(User, { id: userId }, 'goldBalance', FEED_COST);
      await manager.update(NftGuardDog, { id: dogId }, { lastFedAt: new Date() });

      await this.economyOracle.record(manager, {
        userId,
        amount: FEED_COST,
        type: 'BURN',
        category: 'DOG_FEED',
        description: `Fed guard dog ${dog.dogType}`,
      });

      const hoursSinceFedForMsg = hoursSinceFed;
      const wasHungry = hoursSinceFedForMsg >= 24;
      return {
        message: wasHungry ? `${dog.dogType} fed! Defense power restored` : `${dog.dogType} fed!`,
        goldSpent: FEED_COST,
        nextFeedInHours: FEED_COOLDOWN_HOURS,
      };
    });
  }

  // ── Algorithmic Dynamic Peg Rate Engine (PRD 1, PRD 2 & Dynamic Peg Doc) ──────────

  async getDynamicRates(): Promise<{
    farmPriceUsd: number;
    farmPriceBnb: number;
    baseGoldUsdValue: number;
    baseRate: number;
    alpha: number;
    depositFee: number;
    withdrawFee: number;
    depositRate: number;
    withdrawRate: number;
    goldPerFarmWithdraw: number;
    goldMinted24h: number;
    goldBurned24h: number;
    burnMintRatio: number;
    economyStatus: 'balanced' | 'deflationary' | 'inflationary';
    treasuryFarmBalance: number;
    killSwitchActive: boolean;
    killSwitchReason: string | null;
    lastUpdated: string;
  }> {
    // 1. Live DEX price from DexOracleService
    const dexPrice = await this.dexOracle.getDexPrice();
    let farmPriceUsd = dexPrice?.priceUsd ?? 0;
    let farmPriceBnb = dexPrice?.priceBnb ?? 0;
    if (!farmPriceUsd || farmPriceUsd <= 0) {
      farmPriceUsd = 0.000146;
      farmPriceBnb = 0.0000002;
    }

    // 2. Economy stats from EconomyOracleService
    const economyStats = await this.economyOracle.getEconomyStats();
    const alpha = economyStats.alpha;

    // 3. Pool balance from Claim contract (or treasury)
    let poolBalance = 50000;
    try {
      const claimContractAddress = this.config.get<string>('web3.claimContractAddress');
      const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress');
      if (this.provider && claimContractAddress && farmTokenAddress) {
        const erc20 = new ethers.Contract(
          farmTokenAddress,
          ['function balanceOf(address) view returns (uint256)'],
          this.provider,
        );
        const bal = (await this.withDeadline(
          erc20.balanceOf(claimContractAddress),
          this.rpcRequestDeadlineMs,
          'claimContract balanceOf',
        )) as bigint;
        poolBalance = Number(ethers.formatEther(bal));
      }
    } catch (err) {
      this.logger.warn(`Could not read claim contract FARM balance: ${(err as Error).message}`);
    }

    // 4. Volatility & Liquidity Kill-Switch
    let killSwitchActive = false;
    let killSwitchReason: string | null = null;
    try {
      killSwitchActive = await this.dexOracle.isKillSwitchActive();
      if (killSwitchActive) {
        killSwitchReason = await this.dexOracle.getKillSwitchReason();
      }
    } catch {
      // ignore
    }

    if (poolBalance < this.MIN_TREASURY_RESERVE_FARM) {
      killSwitchActive = true;
      killSwitchReason = 'Treasury reserve is protecting liquidity';
    }

    // 5. Algorithmic Dynamic Peg formulas:
    // Base_Rate = FARM_USD / BASE_GOLD_USD
    const baseRate = farmPriceUsd / this.BASE_GOLD_USD_VALUE;
    // Deposit Rate = Base_Rate * (1 - DEPOSIT_FEE)
    const depositRate = baseRate * (1 - this.DEPOSIT_FEE);
    // Withdraw Rate = (1 / Base_Rate) * Alpha * (1 - WITHDRAW_FEE)
    const withdrawRate = (1 / baseRate) * alpha * (1 - this.WITHDRAW_FEE);
    const goldPerFarmWithdraw = withdrawRate > 0 ? 1 / withdrawRate : baseRate;

    return {
      farmPriceUsd: Number(farmPriceUsd.toFixed(8)),
      farmPriceBnb: Number(farmPriceBnb.toFixed(8)),
      baseGoldUsdValue: this.BASE_GOLD_USD_VALUE,
      baseRate: Number(baseRate.toFixed(4)),
      alpha: Number(alpha.toFixed(4)),
      depositFee: this.DEPOSIT_FEE,
      withdrawFee: this.WITHDRAW_FEE,
      depositRate: Number(depositRate.toFixed(4)),
      withdrawRate: Number(withdrawRate.toFixed(6)),
      goldPerFarmWithdraw: Number(goldPerFarmWithdraw.toFixed(2)),
      goldMinted24h: economyStats.goldMinted24h,
      goldBurned24h: economyStats.goldBurned24h,
      burnMintRatio: economyStats.burnMintRatio,
      economyStatus: economyStats.status,
      treasuryFarmBalance: Number(poolBalance.toFixed(2)),
      killSwitchActive,
      killSwitchReason,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── Exchange Rate Endpoint (Legacy compatibility + Dynamic Peg) ─────────────────
  async getExchangeRate(): Promise<{
    goldPerFarm: number;
    totalGoldCirculating: number;
    farmInTreasury: number;
    farmPriceUsd: number;
    farmPriceBnb: number;
    source: string;
    inflationWarning: boolean;
    killSwitchActive: boolean;
    lastUpdated: string;
    note: string;
    baseGoldUsdValue: number;
    baseRate: number;
    alpha: number;
    depositFee: number;
    withdrawFee: number;
    depositRate: number;
    withdrawRate: number;
    goldMinted24h: number;
    goldBurned24h: number;
    burnMintRatio: number;
    economyStatus: string;
  }> {
    const dynamic = await this.getDynamicRates();

    const [{ total }] = (await this.dataSource.manager.query(
      `SELECT COALESCE(SUM(gold_balance), 0)::float AS total FROM users`,
    )) as [{ total: number }];

    return {
      goldPerFarm: dynamic.goldPerFarmWithdraw,
      totalGoldCirculating: Number(total) || 0,
      farmInTreasury: dynamic.treasuryFarmBalance,
      farmPriceUsd: dynamic.farmPriceUsd,
      farmPriceBnb: dynamic.farmPriceBnb,
      source: 'pancakeswap-v2-dynamic-peg',
      inflationWarning: dynamic.alpha < 0.7,
      killSwitchActive: dynamic.killSwitchActive,
      lastUpdated: dynamic.lastUpdated,
      note: dynamic.killSwitchReason ?? `Dynamic Peg (alpha=${dynamic.alpha}, baseRate=${dynamic.baseRate})`,
      baseGoldUsdValue: dynamic.baseGoldUsdValue,
      baseRate: dynamic.baseRate,
      alpha: dynamic.alpha,
      depositFee: dynamic.depositFee,
      withdrawFee: dynamic.withdrawFee,
      depositRate: dynamic.depositRate,
      withdrawRate: dynamic.withdrawRate,
      goldMinted24h: dynamic.goldMinted24h,
      goldBurned24h: dynamic.goldBurned24h,
      burnMintRatio: dynamic.burnMintRatio,
      economyStatus: dynamic.economyStatus,
    };
  }

  // ── $FARM → GOLD Deposit Flow ───────────────────────────────────

  private readonly ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function decimals() view returns (uint8)',
  ];

  async getDepositInfo() {
    const treasuryAddress =
      this.config.get<string>('web3.depositTreasuryAddress') ||
      (this.adminWallet?.address ?? '');
    const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
    const chainId = this.config.get<number>('web3.chainId') ?? 97;
    const rates = await this.getDynamicRates();

    return {
      treasuryAddress,
      farmTokenAddress,
      goldPerFarm: rates.depositRate,
      baseRate: rates.baseRate,
      alpha: rates.alpha,
      depositFee: rates.depositFee,
      chainId,
      instructions: [
        `Send $FARM token to the treasury address: ${treasuryAddress}`,
        `Minimum deposit: 1 $FARM`,
        `Rate: 1 $FARM = ${rates.depositRate} GOLD (Dynamic Peg, live market rate, 0% fee)`,
        `After sending, submit your transaction hash via POST /web3/deposit-verify`,
      ],
      note: 'Deposit converts $FARM into in-game GOLD. To cash out back to $FARM, use Convert / Claim.',
    };
  }

  async verifyDeposit(userId: string, txHash: string): Promise<{
    goldCredited: number;
    goldBalance: number;
    txHash: string;
    farmAmount: number;
    depositRate: number;
  }> {
    if (!this.provider) throw new BadRequestException('Blockchain connection not available');

    const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
    if (!farmTokenAddress) throw new BadRequestException('Farm token not configured');

    const treasuryAddress = (
      this.config.get<string>('web3.depositTreasuryAddress') || this.adminWallet?.address
    )?.toLowerCase();
    if (!treasuryAddress) throw new BadRequestException('Treasury address not configured');

    const user = await this.dataSource.manager.findOne(User, { where: { id: userId } });
    if (!user?.walletAddress) throw new BadRequestException('Link a BSC wallet before depositing');

    const already = await this.dataSource.manager.query(
      `SELECT 1 FROM processed_onchain_txs WHERE tx_hash = $1`,
      [txHash.toLowerCase()],
    );
    if (already.length > 0) throw new BadRequestException('Transaction already processed');

    let receipt: ethers.TransactionReceipt | null;
    try {
      receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) throw new BadRequestException('Transaction not found or not yet confirmed on BSC');
      if (receipt.status !== 1) throw new BadRequestException('Transaction reverted on-chain');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Deposit verify RPC failed for ${txHash}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Blockchain network unavailable — please retry shortly',
      );
    }

    const farmContract = new ethers.Contract(farmTokenAddress, this.ERC20_ABI, this.provider);
    const senderLower = user.walletAddress.trim().toLowerCase();
    const treasuryLower = treasuryAddress.trim().toLowerCase();
    const validFarmTokens = new Set([
      farmTokenAddress.toLowerCase(),
      '0x7eadd0273eb170b4ba28050f675c4878beb75ae3',
      '0xb10067a034078e3fc8335fb003eef7334c44952f',
    ].filter(Boolean));

    let matchingLog: { from: string; to: string; value: bigint } | null = null;
    for (const log of receipt.logs) {
      if (!validFarmTokens.has(log.address.toLowerCase())) continue;
      try {
        const parsed = farmContract.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (
          parsed &&
          parsed.name === 'Transfer' &&
          parsed.args[0]?.toLowerCase() === senderLower &&
          parsed.args[1]?.toLowerCase() === treasuryLower
        ) {
          matchingLog = {
            from: parsed.args[0],
            to: parsed.args[1],
            value: parsed.args[2] as bigint,
          };
          break;
        }
      } catch {
        // Skip non-matching logs
      }
    }

    if (!matchingLog) {
      throw new BadRequestException(
        'No $FARM Transfer to treasury found in this transaction from your wallet',
      );
    }

    const farmAmountWei = matchingLog.value;
    const farmAmount = Number(ethers.formatEther(farmAmountWei));
    if (farmAmount < 1) throw new BadRequestException('Minimum deposit is 1 $FARM');

    const rates = await this.getDynamicRates();
    const goldToCredit = Number((farmAmount * rates.depositRate).toFixed(2));
    if (goldToCredit <= 0) throw new BadRequestException('Deposit amount too small to credit GOLD');

    // Atomic: mark tx processed + credit GOLD + record gold transaction
    await this.dataSource.transaction(async (manager) => {
      const result: any = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, log_index, event_type)
         VALUES ($1, 0, 'FarmDeposit')
         ON CONFLICT (tx_hash, log_index) DO NOTHING`,
        [txHash.toLowerCase()],
      );
      if (result.rowCount === 0) throw new BadRequestException('Transaction already processed');

      await manager.query(
        `UPDATE users SET gold_balance = gold_balance + $1 WHERE id = $2`,
        [goldToCredit, userId],
      );

      await this.economyOracle.record(manager, {
        userId,
        amount: goldToCredit,
        type: 'MINT',
        category: 'FARM_DEPOSIT',
        description: `Deposit ${farmAmount.toFixed(4)} FARM for ${goldToCredit} GOLD (rate: ${rates.depositRate.toFixed(2)} G/FARM)`,
      });
    });

    const updated = await this.dataSource.manager.findOne(User, { where: { id: userId } });
    this.logger.log(`Deposit: ${farmAmount} $FARM → ${goldToCredit} GOLD for user ${userId} tx=${txHash}`);

    return {
      goldCredited: goldToCredit,
      goldBalance: Number(updated?.goldBalance ?? 0),
      txHash,
      farmAmount,
      depositRate: rates.depositRate,
    };
  }

  // Background sync: every 30 minutes, re-sync the 50 most recently active wallet users
  @Cron('0 */30 * * * *')
  async scheduledNftSync(): Promise<void> {
    if (!this.provider) return;

    const nftContractAddress = this.config.get<string>('web3.nftContractAddress') ?? '';
    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') return;

    const users = await this.dataSource.manager
      .createQueryBuilder(User, 'u')
      .where('u.wallet_address IS NOT NULL')
      .orderBy('u.updated_at', 'DESC')
      .limit(50)
      .getMany();

    if (users.length === 0) return;
    this.logger.log(`Scheduled NFT sync: processing ${users.length} users`);

    for (const user of users) {
      if (!user.walletAddress) continue;
      // One user's failure must not abort the sweep for everyone queued behind them —
      // the scheduler would otherwise lose the remainder of the batch.
      try {
        await this.syncGuardDogs(user.id, user.walletAddress);
      } catch (err) {
        this.logger.warn(
          `Scheduled NFT sync failed for ${user.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ── Dual-Layer Protection: Tiered Quota & Global Drip-Feed Engine ──────────

  getUserCashoutTier(user: Partial<User>): UserCashoutTier {
    if (!user.walletAddress || (user.trustScore ?? 0) < 30) {
      return UserCashoutTier.TIER_0;
    }
    const level = user.level ?? 1;
    const trustScore = user.trustScore ?? 50;

    if (level >= 10 || trustScore >= 80) {
      return UserCashoutTier.TIER_3;
    }
    if (level >= 5 || trustScore >= 60) {
      return UserCashoutTier.TIER_2;
    }
    return UserCashoutTier.TIER_1;
  }

  async getCashoutQuota(user: User): Promise<CashoutQuotaResponse> {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const poolInfo = await this.economyOracle.getDailyCashoutPool(todayUtc);

    const tier = this.getUserCashoutTier(user);
    const tierPct = CASHOUT_TIER_PERCENTAGES[tier];
    const userDailyLimit = Number((poolInfo.globalDailyPoolFarm * tierPct).toFixed(2));

    const [globalSpentRaw, userSpentRaw] = await Promise.all([
      this.redis.get(`cashout:global:${todayUtc}`),
      this.redis.get(`cashout:user:${user.id}:${todayUtc}`),
    ]);

    const globalSpentToday = globalSpentRaw ? Number(globalSpentRaw) : 0;
    const userSpentToday = userSpentRaw ? Number(userSpentRaw) : 0;

    const globalRemaining = Math.max(0, Number((poolInfo.globalDailyPoolFarm - globalSpentToday).toFixed(2)));
    const userRemaining = Math.max(0, Number((userDailyLimit - userSpentToday).toFixed(2)));

    let canWithdraw = true;
    let reason: string | undefined;

    if (tier === UserCashoutTier.TIER_0) {
      canWithdraw = false;
      reason = !user.walletAddress
        ? 'No BSC wallet linked. Link your wallet to unlock cashouts.'
        : `Trust score too low (${user.trustScore}/30). Play actively to reach Tier 1.`;
    } else if (globalRemaining <= 0) {
      canWithdraw = false;
      reason = 'Global daily reward pool is exhausted for today. Resets at 00:00 UTC.';
    } else if (userRemaining <= 0) {
      canWithdraw = false;
      reason = `You have reached your Tier ${tier} daily cashout limit (${userDailyLimit} FARM). Resets at 00:00 UTC.`;
    }

    return {
      date: todayUtc,
      tier,
      tierName: CASHOUT_TIER_NAMES[tier],
      tierPercentage: tierPct,
      userDailyLimit,
      userSpentToday: Number(userSpentToday.toFixed(2)),
      userRemaining,
      globalDailyPool: poolInfo.globalDailyPoolFarm,
      globalSpentToday: Number(globalSpentToday.toFixed(2)),
      globalRemaining,
      releaseRate: poolInfo.releaseRate,
      priceGrowth24h: poolInfo.priceGrowth24h,
      totalCirculatingGold: poolInfo.totalCirculatingGold,
      goldPerFarmWithdraw: poolInfo.goldPerFarmWithdraw,
      resetAtUtc: '00:00 UTC',
      canWithdraw,
      reason,
    };
  }

  // ── BNB Tax Revenue Engine & Premium Services ─────────────────────────────

  getBnbServicesConfig() {
    const treasuryVault =
      this.config.get<string>('web3.treasuryContractAddress') ||
      this.config.get<string>('TREASURY_CONTRACT_ADDRESS') ||
      '0xe59FfB05EdF59464e8803E81A4d790d828915006';
    const barnServicesAddress =
      this.config.get<string>('web3.barnServicesAddress') ||
      this.config.get<string>('BARN_SERVICES_ADDRESS') ||
      '0x1D9faFb4f9125dD16d846bF1344954ddd304F14F';
    const gachaContractAddress =
      this.config.get<string>('web3.gachaContractAddress') ||
      this.config.get<string>('GACHA_CONTRACT_ADDRESS') ||
      '0x5f0c3c5A4745c5EffAd7328AD93972f6474B4118';
    const marketContractAddress =
      this.config.get<string>('web3.marketContractAddress') ||
      this.config.get<string>('MARKET_CONTRACT_ADDRESS') ||
      '0xe2326Fa33b9293488FDCaA3F34Be2745a2f49e11';

    return {
      treasuryVault,
      barnServicesAddress,
      gachaContractAddress,
      marketContractAddress,
      tokenizeDog: {
        singleFeeBnb: 0.002,
        bulk3xFeeBnb: 0.005,
        farmCostSingle: 15,
        farmCost3x: 40,
      },
      marketplace: {
        bnbTradingFeeBps: 300, // 3%
        feeDestination: treasuryVault,
      },
      subscriptions: [
        {
          subType: 1,
          name: '7-Day Barn Butler & Crop Insurance',
          priceBnb: 0.005,
          durationDays: 7,
          features: [
            'Auto-harvest mature crops every 30 minutes',
            '80% Crop theft compensation insurance',
          ],
        },
        {
          subType: 2,
          name: '30-Day Barn Butler & Crop Insurance',
          priceBnb: 0.015,
          durationDays: 30,
          features: [
            'Auto-harvest mature crops every 30 minutes',
            '80% Crop theft compensation insurance',
            'Priority Auto Buyback & Drip-feed Perks',
          ],
        },
      ],
    };
  }

  async verifySubscriptionTx(user: User, txHash: string) {
    if (!user.walletAddress) throw new BadRequestException('No wallet linked');
    if (!txHash || !txHash.startsWith('0x')) throw new BadRequestException('Invalid txHash');

    const provider = this.getProvider();
    if (!provider) throw new ServiceUnavailableException('RPC provider offline');

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new BadRequestException('Transaction not yet confirmed on BSC');
    if (receipt.status !== 1) throw new BadRequestException('Transaction reverted on-chain');

    const barnServicesAddr =
      this.config.get<string>('web3.barnServicesAddress') ||
      this.config.get<string>('BARN_SERVICES_ADDRESS') ||
      '0x1D9faFb4f9125dD16d846bF1344954ddd304F14F';

    const iface = new ethers.Interface([
      'event SubscriptionPurchased(address indexed user, uint8 indexed subType, uint256 expiry, uint256 bnbPaid)',
    ]);

    let parsedLog: any = null;
    let logIndex = 0;
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      if (log.address.toLowerCase() === barnServicesAddr.toLowerCase()) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed && parsed.name === 'SubscriptionPurchased') {
            parsedLog = parsed;
            logIndex = i;
            break;
          }
        } catch {
          // continue
        }
      }
    }

    if (!parsedLog) {
      throw new BadRequestException('No SubscriptionPurchased event found for BarnServices in this transaction');
    }

    const eventUser = (parsedLog.args[0] as string).toLowerCase();
    if (eventUser !== user.walletAddress.toLowerCase()) {
      throw new BadRequestException('Transaction sender does not match user wallet');
    }

    const subType = Number(parsedLog.args[1]); // 1 or 2
    const expiryTimestamp = Number(parsedLog.args[2]);
    const bnbPaid = ethers.formatEther(parsedLog.args[3]);

    await this.dataSource.transaction(async (manager) => {
      const result: any = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, log_index, event_type)
         VALUES ($1, $2, 'SubscriptionPurchased')
         ON CONFLICT (tx_hash, log_index) DO NOTHING`,
        [txHash.toLowerCase(), logIndex],
      );
      if (result.rowCount === 0) throw new BadRequestException('Transaction already processed');

      const butlerType = subType === 2 ? 'butler_30d' : 'butler_7d';
      const insType = subType === 2 ? 'crop_insurance_30d' : 'crop_insurance_7d';

      await this.guildService.purchaseSubscriptionTx(manager, user.id, butlerType);
      await this.guildService.purchaseSubscriptionTx(manager, user.id, insType);
    });

    // Immediate Buyback check if Vault reached 2.0 BNB
    this.treasuryMonitor.checkAndExecuteBuyBack().catch((err) => {
      this.logger.warn(`Buyback trigger post-subscription check failed: ${err.message}`);
    });

    return {
      success: true,
      subType,
      expiresAt: new Date(expiryTimestamp * 1000),
      bnbPaid,
      message: `Activated ${subType === 2 ? '30-Day' : '7-Day'} Barn Butler & Crop Insurance!`,
    };
  }
}
