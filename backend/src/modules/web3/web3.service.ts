import {
  Injectable, BadRequestException, ForbiddenException, HttpException,
  InternalServerErrorException, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { Cron } from '@nestjs/schedule';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { ClaimIntent } from './entities/claim-intent.entity';
import { RedisService } from '../../common/redis.service';
import { DexOracleService } from './dex-oracle.service';
import { buildClaimDigest } from './claim-digest';

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
  /**
   * True when the chain read could not be performed (node down / timeout / RPC error).
   * The caller is looking at last-known-good state, not at a genuinely empty wallet —
   * the two must stay distinguishable so the UI can say "try again" instead of
   * "you own no dogs".
   */
  unavailable?: boolean;
};

/**
 * True when an error originated in the RPC transport rather than in our own logic.
 *
 * ethers v6 tags transport problems with `code` (NETWORK_ERROR / TIMEOUT / SERVER_ERROR)
 * and keeps the underlying fetch/node error on `cause`. An unreachable or rate-limited
 * node is an operational condition, not a defect: callers should degrade to stale/default
 * data instead of surfacing an unhandled 500. Everything else — a decode error, a DB
 * constraint, a bad address — is rethrown untouched so real bugs stay loud.
 */
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
  private _buildJsonRpcProvider(url: string): ethers.JsonRpcProvider {
    const request = new ethers.FetchRequest(url);
    request.timeout = this.rpcTimeoutMs;
    // polling:false — this service only performs request/response reads, never subscribes.
    return new ethers.JsonRpcProvider(request, undefined, { polling: false });
  }

  /** #44: Ethers.js v6 FallbackProvider with ordered RPC endpoints. */
  private _buildFallbackProvider(): ethers.FallbackProvider {
    const chainId = this.config.get<number>('web3.chainId') ?? 56;

    // The primary default MUST be chosen from the same chain id as the fallbacks. This
    // used to default to a mainnet dataseed node unconditionally, so a testnet-configured
    // process ended up with a mainnet primary and testnet fallbacks — and with `quorum: 1`
    // ethers takes whichever answers first, mixing chains inside a single read.
    const defaultPrimary = chainId === 97
      ? 'https://bsc-testnet-rpc.publicnode.com'
      : 'https://bsc-dataseed1.binance.org/';
    const primary = this.config.get<string>('web3.bscRpcUrl') ?? defaultPrimary;

    const fallbacks = chainId === 97
      ? ['https://bsc-testnet-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/bsc/testnet/public']
      : ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'];

    const networks = [primary, ...fallbacks].map((url, i) => ({
      provider: this._buildJsonRpcProvider(url),
      priority: i + 1,
      // Align the stall threshold with the fetch timeout so a dead primary is
      // abandoned on the same clock it aborts on, instead of 2s < 5s leaving a
      // half-open request behind.
      stallTimeout: this.rpcTimeoutMs,
      weight: 1,
    }));
    return new ethers.FallbackProvider(networks, undefined, { quorum: 1 });
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

    // Kill-switch check is FAIL-OPEN, deliberately.
    //
    // It is an operator safety lever for market volatility, NOT the authorization gate —
    // that is trustScore + wallet + balance above. When Redis is unreachable (outage, auth
    // failure, network blip) blocking here would take down GOLD→FARM conversion for every
    // player because of an unrelated dependency. The loud ERROR surfaces the degraded state
    // for ops, and the owner retains pause() as the hard stop.
    //
    // If the requirement is instead fail-CLOSED, the fix belongs in DexOracleService — it
    // should serve the last known state from a local cache rather than propagate the
    // connection error — not here.
    let killActive = false;
    try {
      // Deadlined for the same reason as the RPC calls: a stalled Redis connection
      // must not be able to hold an HTTP request open until the proxy gives up.
      killActive = await this.withDeadline(
        this.dexOracle.isKillSwitchActive(),
        this.rpcRequestDeadlineMs,
        'kill-switch check',
      );
    } catch (err) {
      this.logger.error(
        `Kill-switch check unavailable, proceeding without it: ${(err as Error).message}`,
      );
    }
    if (killActive) {
      const reason = await this.withDeadline(
        this.dexOracle.getKillSwitchReason(),
        this.rpcRequestDeadlineMs,
        'kill-switch reason',
      ).catch(() => null);
      throw new ServiceUnavailableException(
        reason ?? 'Claiming paused due to high market volatility. Try again later.',
      );
    }

    if (!this.adminWallet) {
      throw new InternalServerErrorException('Signing service not configured');
    }

    // Resolve the domain BEFORE opening the transaction: the digest is bound to
    // (chainid, claimContract) and getNetwork() may hit the RPC. Never hold a
    // pessimistic_write row lock across network I/O. (ethers v6 memoises getNetwork(), so
    // this is one RPC call per process lifetime, not per claim.)
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
      // Never wait forever on a row lock. Postgres defaults lock_timeout to 0 (infinite),
      // so a sibling transaction holding this user's row — an admin edit, or a request
      // that is itself stuck — would keep us open until the gateway timed out with 504.
      // 3s converts that into an immediate, explicit 503.
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

      const amountWei = ethers.parseUnits(amountToClaim.toString(), 18);

      // Sign against the wallet read UNDER the row lock. The pre-lock copy can be stale,
      // and FarmTokenClaim only pays out to the address bound into the signature — signing
      // a stale address produces a signature the player's current wallet cannot use.
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

      await queryRunner.commitTransaction();

      this.logger.log(`Claim signature: user=${user.id} amount=${amountToClaim} nonce=${currentNonce}`);

      return {
        // The address bound into the signature — the client must call claimTokens from it.
        userAddress: walletAddress,
        amountWei: amountWei.toString(),
        nonce: currentNonce,
        signature,
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

  async refundClaim(userId: string, nonce: number) {
    const intent = await this.dataSource.manager.findOne(ClaimIntent, {
      where: { userId, nonce, status: 'pending' },
    });

    if (!intent) {
      throw new BadRequestException('No pending claim found for this nonce — already refunded or completed.');
    }

    // On-chain check: verify the nonce was never used on-chain (5s timeout)
    const claimContractAddress = this.config.get<string>('web3.claimContractAddress') ?? '';
    if (this.provider && claimContractAddress && claimContractAddress.length > 10) {
      try {
        const contract = new ethers.Contract(
          claimContractAddress,
          ['function isNonceUsed(address,uint256) external view returns (bool)'],
          this.provider,
        );
        const checkWithTimeout = Promise.race([
          contract.isNonceUsed(intent.walletAddress, nonce) as Promise<boolean>,
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 5000)),
        ]);
        const nonceUsed = await checkWithTimeout;
        if (nonceUsed) {
          await this.dataSource.manager.update(ClaimIntent, { id: intent.id }, { status: 'completed' });
          throw new BadRequestException('Claim was already confirmed on-chain — no refund possible.');
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`On-chain nonce check skipped: ${(err as Error).message} — proceeding with refund`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const amount = Number(intent.amountGold);
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({ goldBalance: () => `"gold_balance" + ${amount}` })
        .where('id = :id', { id: userId })
        .execute();

      await queryRunner.manager.update(ClaimIntent, { id: intent.id }, { status: 'refunded' });
      await queryRunner.commitTransaction();

      this.logger.log(`Claim refunded: user=${userId} nonce=${nonce} gold=+${amount}`);
      return { refunded: true, goldRestored: amount };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
          { isActive: false },
        );

        for (const dog of ownedDogs) {
          const existing = await queryRunner.manager.findOne(NftGuardDog, {
            where: { ownerId: userId, tokenId: dog.tokenId, source: 'nft' },
          });

          if (existing) {
            // Preserve isGuarding — user may have put this dog in storage intentionally
            await queryRunner.manager.update(NftGuardDog, { id: existing.id }, {
              isActive: true,
              defensePower: dog.defensePower,
              dogType: dog.dogType,
            });
          } else {
            // First time seeing this dog — default to guarding
            await queryRunner.manager.insert(NftGuardDog, {
              ownerId: userId,
              tokenId: dog.tokenId,
              dogType: dog.dogType,
              defensePower: dog.defensePower,
              isActive: true,
              isGuarding: true,
              source: 'nft',
            });
          }
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

        const totalNftDefense = ownedDogs.reduce((sum, d) => sum + d.defensePower, 0);
        this.logger.log(
          `NFT sync: user=${userId} dogs=${ownedDogs.length} defense=${totalNftDefense} shards=${shardBalance}`,
        );

        return { synced: ownedDogs.length, totalNftDefense, dogs: ownedDogs, shards: shardBalance };
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

    const ownedBreeds = dogs.map((d) => ({
      tokenId: d.tokenId,
      dogType: d.dogType,
      defensePower: d.defensePower,
      isGuarding: d.isGuarding,
    }));

    const guardingDogs = dogs.filter((d) => d.isGuarding);
    return {
      ownedBreeds,
      totalNftDefense: guardingDogs.reduce((sum, d) => sum + d.defensePower, 0),
      breedCount: dogs.length,
    };
  }

  async setDogGuarding(userId: string, tokenId: number, isGuarding: boolean) {
    const dog = await this.dataSource.manager.findOne(NftGuardDog, {
      where: { ownerId: userId, tokenId, source: 'nft', isActive: true },
    });
    if (!dog) throw new BadRequestException('Guard dog not found in your wallet');

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

      const hoursSinceFed = (Date.now() - new Date(dog.lastFedAt).getTime()) / 3_600_000;
      if (hoursSinceFed < FEED_COOLDOWN_HOURS) {
        const nextFeedHours = Math.ceil(FEED_COOLDOWN_HOURS - hoursSinceFed);
        throw new BadRequestException(`Dog already fed. Next feeding in ${nextFeedHours}h`);
      }

      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');
      if (user.goldBalance < FEED_COST) throw new BadRequestException(`Not enough gold. Need ${FEED_COST}G`);

      await manager.decrement(User, { id: userId }, 'goldBalance', FEED_COST);
      await manager.update(NftGuardDog, { id: dogId }, { lastFedAt: new Date() });

      const hoursSinceFedForMsg = hoursSinceFed;
      const wasHungry = hoursSinceFedForMsg >= 24;
      return {
        message: wasHungry ? `${dog.dogType} fed! Defense power restored` : `${dog.dogType} fed!`,
        goldSpent: FEED_COST,
        nextFeedInHours: FEED_COOLDOWN_HOURS,
      };
    });
  }

  // ── Exchange Rate Engine (#18 + #73) ────────────────────────────
  private cachedRate: number = 1.0;
  private cachedGoldCirculating: number = 0;
  private cachedFarmInTreasury: number = 0;
  private cachedFarmPriceUsd: number = 0;
  private cachedFarmPriceBnb: number = 0;
  private cachedPriceSource: string = 'treasury_ratio';
  private cachedKillSwitchActive: boolean = false;
  private rateCachedAt: number = 0;
  private readonly RATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getExchangeRate(): Promise<{
    goldPerFarm: number; totalGoldCirculating: number; farmInTreasury: number;
    farmPriceUsd: number; farmPriceBnb: number; source: string;
    inflationWarning: boolean; killSwitchActive: boolean;
    lastUpdated: string; note: string;
  }> {
    if (Date.now() - this.rateCachedAt < this.RATE_TTL_MS) {
      return this.buildRateResponse('cached');
    }
    await this.syncExchangeRate();
    return this.buildRateResponse(this.cachedPriceSource === 'dex' ? 'dex' : 'treasury_ratio');
  }

  private buildRateResponse(note: string) {
    return {
      goldPerFarm: this.cachedRate,
      totalGoldCirculating: this.cachedGoldCirculating,
      farmInTreasury: this.cachedFarmInTreasury,
      farmPriceUsd: this.cachedFarmPriceUsd,
      farmPriceBnb: this.cachedFarmPriceBnb,
      source: this.cachedPriceSource,
      inflationWarning: this.cachedRate > 200,
      killSwitchActive: this.cachedKillSwitchActive,
      lastUpdated: new Date(this.rateCachedAt).toISOString(),
      note,
    };
  }

  @Cron('*/5 * * * *')
  async syncExchangeRate(): Promise<void> {
    try {
      // Primary: DEX price from Redis (populated by DexOracleService every 3 min)
      const usd = await this.redis.get('dex:farm:price:usd');
      const bnb = await this.redis.get('dex:farm:price:bnb');
      const usdNum = Number(usd);
      const bnbNum = Number(bnb);

      if (usd != null && bnb != null && Number.isFinite(usdNum) && usdNum > 0 && Number.isFinite(bnbNum) && bnbNum > 0) {
        this.cachedFarmPriceUsd = usdNum;
        this.cachedFarmPriceBnb = bnbNum;
        this.cachedRate = Number((0.001 / usdNum).toFixed(4)); // 1 GOLD = $0.001
        this.cachedPriceSource = 'dex';
      } else {
        // Fallback: treasury balance ratio
        const [{ total }] = await this.dataSource.manager.query(
          `SELECT COALESCE(SUM(gold_balance), 0)::float AS total FROM users`,
        ) as [{ total: number }];
        const goldCirc = Number(total);
        let farmInTreasury = 0;
        if (this.provider && this.adminWallet) {
          const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
          if (farmTokenAddress && farmTokenAddress.length > 10) {
            // Contained RPC read: a node outage here must not abort the whole cron and
            // reset the cached rate to the 1.0 default. Treasury balance is a bonus
            // signal — 0 simply means "ratio unavailable", which the response reports.
            try {
              const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
              const token = new ethers.Contract(farmTokenAddress, erc20ABI, this.provider);
              const bal = await token.balanceOf(this.adminWallet.address) as bigint;
              farmInTreasury = Number(ethers.formatEther(bal));
            } catch (err) {
              this.logger.warn(
                `Treasury FARM balance unavailable: ${(err as Error).message}`,
              );
            }
          }
        }
        this.cachedGoldCirculating = goldCirc;
        this.cachedFarmInTreasury = farmInTreasury;
        this.cachedRate = farmInTreasury > 0 && goldCirc > 0
          ? Number((goldCirc / farmInTreasury).toFixed(4))
          : 1.0;
        this.cachedPriceSource = 'treasury_ratio';
      }

      // Redis is a separate dependency from the chain. A blip must not discard a rate
      // we just computed from DEX prices — keep the last known kill-switch state.
      try {
        const ks = await this.redis.get('kill_switch:active');
        this.cachedKillSwitchActive = !!ks;
      } catch (err) {
        this.logger.warn(
          `Kill-switch state unavailable, keeping last known value: ${(err as Error).message}`,
        );
      }
    } catch {
      this.cachedRate = 1.0;
    } finally {
      this.rateCachedAt = Date.now();
    }
  }

  // ── $FARM → GOLD Deposit Flow (#72) ─────────────────────────────

  // Fixed deposit rate: 1 $FARM = 100 GOLD
  private readonly GOLD_PER_FARM = 100;

  // ERC-20 Transfer event ABI
  private readonly ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function decimals() view returns (uint8)',
  ];

  getDepositInfo() {
    const treasuryAddress = this.config.get<string>('web3.depositTreasuryAddress')
      || (this.adminWallet?.address ?? '');
    const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
    const chainId = this.config.get<number>('web3.chainId') ?? 97;

    return {
      treasuryAddress,
      farmTokenAddress,
      goldPerFarm: this.GOLD_PER_FARM,
      chainId,
      instructions: [
        `Send $FARM token to the treasury address: ${treasuryAddress}`,
        `Minimum deposit: 1 $FARM`,
        `Rate: 1 $FARM = ${this.GOLD_PER_FARM} GOLD (fixed rate, instant credit)`,
        `After sending, submit your transaction hash via POST /web3/deposit-verify`,
      ],
      note: 'Deposit is one-way (Farm→Gold). To convert Gold back to $FARM, use the Claim feature.',
    };
  }

  async verifyDeposit(userId: string, txHash: string): Promise<{
    goldCredited: number;
    goldBalance: number;
    txHash: string;
    farmAmount: number;
  }> {
    if (!this.provider) throw new BadRequestException('Blockchain connection not available');

    const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
    if (!farmTokenAddress) throw new BadRequestException('Farm token not configured');

    const treasuryAddress = (
      this.config.get<string>('web3.depositTreasuryAddress') || this.adminWallet?.address
    )?.toLowerCase();
    if (!treasuryAddress) throw new BadRequestException('Treasury address not configured');

    // Fetch user and verify wallet linked
    const user = await this.dataSource.manager.findOne(User, { where: { id: userId } });
    if (!user?.walletAddress) throw new BadRequestException('Link a BSC wallet before depositing');

    // Prevent replay — check processed_onchain_txs (same table used by marketplace)
    const already = await this.dataSource.manager.query(
      `SELECT 1 FROM processed_onchain_txs WHERE tx_hash = $1`,
      [txHash.toLowerCase()],
    );
    if (already.length > 0) throw new BadRequestException('Transaction already processed');

    // Both the receipt fetch and queryFilter() are pure chain reads, so a transport
    // hiccup must degrade to "upstream unavailable" instead of crashing the request.
    // Previously only getTransactionReceipt was guarded: a queryFilter() failure escaped
    // this method entirely and surfaced as an unhandled 500 even though the deposit the
    // player submitted may be perfectly valid and simply need a retry.
    let receipt: ethers.TransactionReceipt | null;
    let logs: Array<ethers.Log | ethers.EventLog>;
    try {
      receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) throw new BadRequestException('Transaction not found or not yet confirmed');
      if (receipt.status !== 1) throw new BadRequestException('Transaction reverted on-chain');

      // Parse Transfer events from the FarmToken contract
      const farmContract = new ethers.Contract(farmTokenAddress, this.ERC20_ABI, this.provider);
      const transferFilter = farmContract.filters.Transfer(null, treasuryAddress);
      logs = await farmContract.queryFilter(transferFilter, receipt.blockNumber, receipt.blockNumber);
    } catch (err) {
      // The BadRequestException above is a verdict about the transaction itself, not a
      // transport failure — it keeps its 400 semantics.
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Deposit verify RPC failed for ${txHash}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Blockchain network unavailable — please retry shortly',
      );
    }

    // Find Transfer log matching this txHash and sender = user's wallet
    const senderLower = user.walletAddress.toLowerCase();
    const matchingLog = logs.find(
      (log) =>
        log.transactionHash.toLowerCase() === txHash.toLowerCase() &&
        'args' in log &&
        (log as ethers.EventLog).args.from.toLowerCase() === senderLower,
    );

    if (!matchingLog) {
      throw new BadRequestException(
        'No $FARM Transfer to treasury found in this transaction from your wallet',
      );
    }

    const farmAmountWei = (matchingLog as ethers.EventLog).args.value as bigint;
    const farmAmount = Number(ethers.formatEther(farmAmountWei));
    if (farmAmount < 1) throw new BadRequestException('Minimum deposit is 1 $FARM');

    const goldToCredit = Math.floor(farmAmount * this.GOLD_PER_FARM);

    // Atomic: mark tx processed + credit GOLD
    await this.dataSource.transaction(async (manager) => {
      const result: any = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, event_type)
         VALUES ($1, 'FarmDeposit')
         ON CONFLICT (tx_hash) DO NOTHING`,
        [txHash.toLowerCase()],
      );
      if (result.rowCount === 0) throw new BadRequestException('Transaction already processed');

      await manager.query(
        `UPDATE users SET gold_balance = gold_balance + $1 WHERE id = $2`,
        [goldToCredit, userId],
      );
    });

    const updated = await this.dataSource.manager.findOne(User, { where: { id: userId } });
    this.logger.log(`Deposit: ${farmAmount} $FARM → ${goldToCredit} GOLD for user ${userId} tx=${txHash}`);

    return {
      goldCredited: goldToCredit,
      goldBalance: Number(updated?.goldBalance ?? 0),
      txHash,
      farmAmount,
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
}
