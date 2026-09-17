import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
  OnModuleInit, OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, IsNull, Not } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { ProcessedOnchainTx } from './entities/processed-onchain-tx.entity';
import { SystemConfig } from './entities/system-config.entity';
import { User } from '../user/entities/user.entity';
import { UserItem } from '../user/entities/user-item.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { CreateListingDto, CreateItemListingDto, GetListingsQueryDto } from './dto/marketplace.dto';
import { EventsGateway } from './events.gateway';
import { NotificationService } from '../notification/notification.service';

// BanditMarket v2 ABI — matches deployed contract events exactly
const BANDIT_MARKET_ABI = [
  'event NFTOrderFilled(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 amount, uint256 priceFarm, uint256 fee)',
  'event NFTOrderFilledBNB(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 amount, uint256 priceBNB, uint256 fee)',
  'event OffchainItemSold(address indexed buyer, address indexed seller, string itemType, uint256 quantity, uint256 priceFarm, uint256 fee, uint256 nonce)',
  'event OrderCancelled(address indexed seller, uint256 nonce)',
];

// EIP-712 typehash — must match BanditMarket.sol NFT_ORDER_TYPEHASH exactly
const NFT_ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
  'NFTOrder(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 priceFarm,uint256 nonce,uint256 deadline)',
));

const LAST_SCANNED_BLOCK_KEY = 'last_scanned_block';
const BLOCK_BATCH_SIZE = 2000;

@Injectable()
export class MarketplaceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketplaceService.name);
  private marketContract: ethers.Contract | null = null;
  private provider: ethers.FallbackProvider | null = null;

  // WSS listener state
  private wssProvider: ethers.WebSocketProvider | null = null;
  private wssContract: ethers.Contract | null = null;
  private wssHeartbeat: ReturnType<typeof setInterval> | null = null;
  private wssReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private wssReconnectDelay = 5_000; // starts at 5s, backs off up to 60s
  private wssDestroyed = false;

  constructor(
    @InjectRepository(MarketplaceListing)
    private readonly listingRepo: Repository<MarketplaceListing>,
    @InjectRepository(ProcessedOnchainTx)
    private readonly processedTxRepo: Repository<ProcessedOnchainTx>,
    @InjectRepository(SystemConfig)
    private readonly sysConfigRepo: Repository<SystemConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserItem)
    private readonly itemRepo: Repository<UserItem>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    const contractAddress = this.config.get<string>('web3.marketContractAddress');
    if (!contractAddress) {
      this.logger.warn('MARKET_CONTRACT_ADDRESS not set — skipping event listeners');
      return;
    }
    this.initHttpProvider(contractAddress);
    this.initWSSListener(contractAddress).catch((e) =>
      this.logger.warn(`WSS listener failed to start: ${e.message}`),
    );
  }

  onModuleDestroy() {
    this.wssDestroyed = true;
    if (this.wssHeartbeat) clearInterval(this.wssHeartbeat);
    if (this.wssReconnectTimeout) clearTimeout(this.wssReconnectTimeout);
    this.wssProvider?.destroy();
  }

  // ── HTTP provider (FallbackProvider) — used by cronjob + initial polling ────

  private initHttpProvider(contractAddress: string): void {
    const chainId = this.config.get<number>('web3.chainId') ?? 56;

    // Primary default must follow the configured chain, exactly like the fallback list
    // below. Defaulting to a mainnet dataseed unconditionally meant a testnet-configured
    // backend had a mainnet primary and testnet fallbacks; with `quorum: 1` the event
    // sweep could read logs from either chain depending on which node answered first.
    const defaultPrimary = chainId === 97
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545/'
      : 'https://bsc-dataseed1.binance.org/';
    const primary = this.config.get<string>('web3.bscRpcUrl') ?? defaultPrimary;

    const fallbacks = chainId === 97
      ? ['https://bsc-testnet.publicnode.com', 'https://data-seed-prebsc-2-s1.binance.org:8545/']
      : ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'];

    this.logger.log(`Marketplace RPC chain id: ${chainId}`);

    const network = ethers.Network.from(chainId);
    const uniqueUrls = Array.from(new Set([primary, ...fallbacks]));
    this.provider = new ethers.FallbackProvider(
      uniqueUrls.map((url, i) => {
        const req = new ethers.FetchRequest(url);
        req.timeout = 5000;
        return {
          provider: new ethers.JsonRpcProvider(req, network, { polling: false, staticNetwork: network }),
          priority: i + 1,
          stallTimeout: 2000,
          weight: 1,
        };
      }),
      network,
      { quorum: 1 },
    );
    this.marketContract = new ethers.Contract(contractAddress, BANDIT_MARKET_ABI, this.provider);
    this.logger.log(`Marketplace HTTP provider ready (${contractAddress})`);
  }

  // ── WSS listener with heartbeat + exponential backoff reconnect ──────────────

  private async initWSSListener(contractAddress: string): Promise<void> {
    if (this.wssDestroyed) return;

    const wssUrl = this.config.get<string>('web3.bscWssUrl');
    if (!wssUrl) {
      this.logger.log('BSC_WSS_URL not set — WSS listener disabled; cronjob fallback active');
      return;
    }

    // Clean up previous connection if reconnecting
    if (this.wssHeartbeat) { clearInterval(this.wssHeartbeat); this.wssHeartbeat = null; }
    this.wssProvider?.destroy();

    try {
      this.wssProvider = new ethers.WebSocketProvider(wssUrl);
      this.wssContract = new ethers.Contract(contractAddress, BANDIT_MARKET_ABI, this.wssProvider);

      this.wssContract.on('NFTOrderFilled', async (buyer, seller, nftContract, tokenId, _a, _p, _f, event) => {
        try {
          const { txHash, logIndex } = MarketplaceService.eventRef(event);
          await this.handleNFTOrderFilled(txHash, logIndex, seller, buyer, nftContract, Number(tokenId));
        } catch (err: any) {
          this.logger.error(`NFTOrderFilled handler: ${err.message}`);
        }
      });

      this.wssContract.on('NFTOrderFilledBNB', async (buyer, seller, nftContract, tokenId, _a, _p, _f, event) => {
        try {
          const { txHash, logIndex } = MarketplaceService.eventRef(event);
          await this.handleNFTOrderFilled(txHash, logIndex, seller, buyer, nftContract, Number(tokenId));
        } catch (err: any) {
          this.logger.error(`NFTOrderFilledBNB handler: ${err.message}`);
        }
      });

      this.wssContract.on('OffchainItemSold', async (buyer, seller, itemType, quantity, _p, _f, nonce, event) => {
        try {
          const { txHash, logIndex } = MarketplaceService.eventRef(event);
          await this.handleOffchainItemSold(txHash, logIndex, buyer, seller, itemType, Number(quantity), Number(nonce));
        } catch (err: any) {
          this.logger.error(`OffchainItemSold handler: ${err.message}`);
        }
      });

      // Reset backoff on successful connect
      this.wssReconnectDelay = 5_000;
      this.logger.log('WSS listener connected and active');

      // Heartbeat: ping every 30s; reconnect on failure
      this.wssHeartbeat = setInterval(async () => {
        try {
          await this.wssProvider!.getBlockNumber();
        } catch {
          this.logger.warn(`WSS heartbeat failed — reconnecting in ${this.wssReconnectDelay / 1000}s`);
          clearInterval(this.wssHeartbeat!);
          this.wssHeartbeat = null;
          this.scheduleWSSReconnect(contractAddress);
        }
      }, 30_000);

    } catch (err: any) {
      this.logger.error(`WSS connect error: ${err.message} — retry in ${this.wssReconnectDelay / 1000}s`);
      this.scheduleWSSReconnect(contractAddress);
    }
  }

  private scheduleWSSReconnect(contractAddress: string): void {
    if (this.wssDestroyed) return;
    this.wssReconnectTimeout = setTimeout(() => {
      // Exponential backoff: 5s → 10s → 20s → 40s → 60s cap
      this.wssReconnectDelay = Math.min(this.wssReconnectDelay * 2, 60_000);
      this.initWSSListener(contractAddress).catch((e) =>
        this.logger.error(`WSS reconnect error: ${e.message}`),
      );
    }, this.wssReconnectDelay);
  }

  /**
   * Normalise a listener payload into the event's identity — (txHash, logIndex).
   *
   * ethers v6 hands the `EventLog` to the listener and nests nothing, but payload shapes
   * differ (`logIndex` on some, `index` on a `Log`), so read all of them defensively.
   * This is not cosmetic: an empty txHash collapses every event onto ('', logIndex) and
   * silently dedupes unrelated logs that happen to share a log index across blocks.
   */
  private static eventRef(payload: any): { txHash: string; logIndex: number } {
    const log = payload?.log ?? payload;
    const txHash: string = log?.transactionHash ?? '';
    const rawIndex = log?.logIndex ?? log?.index ?? 0;
    return { txHash, logIndex: Number(rawIndex) };
  }

  // ── NFTOrderFilled handler (Guard Dogs) ──────────────────────────────────────

  private async handleNFTOrderFilled(
    txHash: string, logIndex: number, sellerWallet: string, buyerWallet: string,
    nftContract: string, tokenId: number,
  ): Promise<void> {
    if (!txHash) throw new Error('NFTOrderFilled: missing transaction hash');

    await this.dataSource.transaction(async (manager) => {
      // Atomic idempotency on the composite (tx_hash, log_index) — one transaction can
      // emit several logs, so keying on tx_hash alone would drop every log after the
      // first.
      //
      // RETURNING (not rowCount) is load-bearing: TypeORM's manager.query() resolves to
      // pg's `rows` array and never exposes `rowCount`, so the previous
      // `result.rowCount === 0` check was always false and this guard never fired.
      const claimed: Array<{ tx_hash: string }> = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, log_index, event_type)
         VALUES ($1, $2, 'NFTOrderFilled')
         ON CONFLICT (tx_hash, log_index) DO NOTHING
         RETURNING tx_hash`,
        [txHash, logIndex],
      );
      if (claimed.length === 0) {
        this.logger.debug(`NFTOrderFilled already processed: ${txHash}#${logIndex}`);
        return;
      }

      // Resolve seller to ensure we only match the actual seller's listing
      const seller = sellerWallet
        ? await manager.findOne(User, { where: { walletAddress: sellerWallet.toLowerCase() } })
        : null;

      const buyer = buyerWallet
        ? await manager.findOne(User, { where: { walletAddress: buyerWallet.toLowerCase() } })
        : null;

      const query = manager
        .createQueryBuilder(MarketplaceListing, 'l')
        .where('l.nft_contract ILIKE :nftContract AND l.token_id = :tokenId AND l.status = :status', {
          nftContract, tokenId, status: 'active',
        });

      if (seller) {
        query.andWhere('l.seller_id = :sellerId', { sellerId: seller.id });
      }

      const listing = await query.setLock('pessimistic_write').getOne();

      if (!listing) {
        // Legitimate no-op: the contract already moved the NFT, so a trade with no DB
        // listing (direct P2P sale) has nothing to book. Marking the event processed is
        // correct — there is no delivery owed.
        this.logger.warn(`NFTOrderFilled: no active listing nftContract=${nftContract} tokenId=${tokenId} seller=${sellerWallet}`);
        return;
      }

      await manager.update(MarketplaceListing, listing.id, {
        status: 'filled',
        buyerId: buyer?.id ?? null,
        filledAt: new Date(),
        txHash,
      });

      // Update the sold dog record
      const soldDog = await manager.findOne(NftGuardDog, {
        where: { listingId: listing.id },
      });
      if (soldDog) {
        if (buyer) {
          await manager.update(NftGuardDog, { id: soldDog.id }, {
            ownerId: buyer.id,
            listingId: null,
            isGuarding: false,
            isActive: true,
          });
        } else {
          await manager.update(NftGuardDog, { id: soldDog.id }, {
            listingId: null,
            isActive: false,
            isGuarding: false,
          });
        }
      }

      if (seller) {
        const priceDisplay = `${Number(listing.priceFarm || 0).toLocaleString()} FARM`;

        this.eventsGateway.notifyTradeFilled(seller.id, {
          itemType: 'Guard Dog NFT',
          quantity: 1,
          price: String(listing.priceFarm || 0),
          priceFormatted: priceDisplay,
          buyerAddress: buyerWallet,
          sellerUserId: seller.id,
          txHash,
          isNFT: true,
        });

        void this.notificationService.notifyItemSold(
          seller.id,
          'Guard Dog NFT',
          1,
          priceDisplay,
          buyer?.username ?? undefined,
          seller.notificationsEnabled && seller.telegramId ? Number(seller.telegramId) : undefined,
        ).catch((err) => this.logger.warn(`Failed to notify seller for dog sale: ${err.message}`));
      }

      this.logger.log(`NFTOrderFilled: tokenId=${tokenId} seller=${sellerWallet} buyer=${buyerWallet} tx=${txHash}#${logIndex}`);
    });
  }

  // ── OffchainItemSold handler (Crates / Magnifying Glass / Master Key) ─────────

  private async handleOffchainItemSold(
    txHash: string, logIndex: number, buyerWallet: string, sellerWallet: string,
    itemType: string, quantity: number, nonce: number,
  ): Promise<void> {
    if (!txHash) throw new Error('OffchainItemSold: missing transaction hash');

    await this.dataSource.transaction(async (manager) => {
      // Atomic idempotency on the composite (tx_hash, log_index) — see handleNFTOrderFilled
      // for why RETURNING is required instead of rowCount.
      const claimed: Array<{ tx_hash: string }> = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, log_index, event_type)
         VALUES ($1, $2, 'OffchainItemSold')
         ON CONFLICT (tx_hash, log_index) DO NOTHING
         RETURNING tx_hash`,
        [txHash, logIndex],
      );
      if (claimed.length === 0) {
        this.logger.debug(`OffchainItemSold already processed: ${txHash}#${logIndex}`);
        return;
      }

      // Resolve seller and buyer by wallet address
      const seller = await manager.findOne(User, {
        where: { walletAddress: sellerWallet.toLowerCase() },
      });
      if (!seller) {
        // Throw, not return. Off-chain items are delivered ONLY by this method, so
        // returning would commit the processed_onchain_txs claim and permanently lose a
        // purchase the buyer already paid FARM for. Throwing rolls the claim back and the
        // next sweep re-delivers.
        throw new Error(`OffchainItemSold: seller wallet ${sellerWallet} not registered`);
      }
      const buyer = await manager.findOne(User, {
        where: { walletAddress: buyerWallet.toLowerCase() },
      });
      if (!buyer) {
        throw new Error(`OffchainItemSold: buyer wallet ${buyerWallet} not registered`);
      }

      // Find active listing matching seller, itemType AND nonce (lock row).
      // Matches exact nonce first to avoid cross-listing confusion when a seller has multiple listings of same item.
      let listing = await manager
        .createQueryBuilder(MarketplaceListing, 'l')
        .where('l.seller_id = :sellerId AND l.item_type = :itemType AND l.nonce = :nonce AND l.status = :status', {
          sellerId: seller.id, itemType, nonce, status: 'active',
        })
        .setLock('pessimistic_write')
        .getOne();

      // Fallback in case nonce was not recorded on legacy listing
      if (!listing) {
        listing = await manager
          .createQueryBuilder(MarketplaceListing, 'l')
          .where('l.seller_id = :sellerId AND l.item_type = :itemType AND l.status = :status', {
            sellerId: seller.id, itemType, status: 'active',
          })
          .setLock('pessimistic_write')
          .getOne();
      }

      if (!listing) {
        throw new Error(
          `OffchainItemSold: no active listing for ${itemType} from ${sellerWallet} nonce=${nonce}`,
        );
      }

      // Transfer item: deduct from seller, add to buyer
      await manager.query(
        `UPDATE user_items
         SET quantity        = GREATEST(0, quantity - $1),
             locked_quantity = GREATEST(0, locked_quantity - $1)
         WHERE user_id = $2 AND item_type = $3`,
        [quantity, seller.id, itemType],
      );
      await manager.query(
        `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (user_id, item_type)
         DO UPDATE SET quantity = user_items.quantity + $3`,
        [buyer.id, itemType, quantity],
      );

      await manager.update(MarketplaceListing, listing.id, {
        status: 'filled', buyerId: buyer.id, filledAt: new Date(), txHash,
      });

      if (seller) {
        const priceDisplay = `${Number(listing.priceFarm || 0).toLocaleString()} FARM`;

        this.eventsGateway.notifyTradeFilled(seller.id, {
          itemType,
          quantity,
          price: String(listing.priceFarm || 0),
          priceFormatted: priceDisplay,
          buyerAddress: buyerWallet,
          sellerUserId: seller.id,
          txHash,
          isNFT: false,
        });

        void this.notificationService.notifyItemSold(
          seller.id,
          itemType,
          quantity,
          priceDisplay,
          buyer?.username ?? undefined,
          seller.notificationsEnabled && seller.telegramId ? Number(seller.telegramId) : undefined,
        ).catch((err) => this.logger.warn(`Failed to notify seller for item sale: ${err.message}`));
      }

      this.logger.log(`OffchainItemSold: ${itemType} ×${quantity} → ${buyerWallet} tx=${txHash}#${logIndex}`);
    });
  }

  // ── Fallback cronjob: scan missed events from last saved block ───────────────

  @Cron('*/5 * * * *')
  async syncMissedTrades(): Promise<void> {
    if (!this.marketContract || !this.provider) return;
    try {
      const currentBlock = await this.provider.getBlockNumber();

      const cfg = await this.sysConfigRepo.findOne({ where: { key: LAST_SCANNED_BLOCK_KEY } });
      // Start from saved block or fall back to last 150 blocks if no record yet
      const fromBlock = cfg ? Number(cfg.value) + 1 : currentBlock - 150;

      if (fromBlock > currentBlock) return;

      // Scan in batches to avoid RPC payload limits
      for (let start = fromBlock; start <= currentBlock; start += BLOCK_BATCH_SIZE) {
        const end = Math.min(start + BLOCK_BATCH_SIZE - 1, currentBlock);

        const [nftEvents, nftBnbEvents, offchainEvents] = await Promise.all([
          this.marketContract.queryFilter(this.marketContract.filters.NFTOrderFilled(), start, end),
          this.marketContract.queryFilter(this.marketContract.filters.NFTOrderFilledBNB(), start, end),
          this.marketContract.queryFilter(this.marketContract.filters.OffchainItemSold(), start, end),
        ]);

        for (const ev of [...nftEvents, ...nftBnbEvents]) {
          if (!('args' in ev)) continue;
          const { buyer, seller, nftContract, tokenId } = (ev as ethers.EventLog).args;
          const { txHash, logIndex } = MarketplaceService.eventRef(ev);
          await this.handleNFTOrderFilled(txHash, logIndex, seller, buyer, nftContract, Number(tokenId));
        }

        for (const ev of offchainEvents) {
          if (!('args' in ev)) continue;
          const { buyer, seller, itemType, quantity, nonce } = (ev as ethers.EventLog).args;
          const { txHash, logIndex } = MarketplaceService.eventRef(ev);
          await this.handleOffchainItemSold(txHash, logIndex, buyer, seller, itemType, Number(quantity), Number(nonce));
        }

        // Persist progress after each batch so a mid-scan crash resumes correctly
        await this.sysConfigRepo.save({ key: LAST_SCANNED_BLOCK_KEY, value: String(end) });
      }

      if (fromBlock <= currentBlock) {
        this.logger.log(`Fallback scan done: blocks ${fromBlock}→${currentBlock}`);
      }
    } catch (e: any) {
      this.logger.warn('syncMissedTrades error:', e.message);
    }
  }

  // ── NFT listing (existing flow) ──────────────────────────────────────────────

  async createListing(userId: string, dto: CreateListingDto): Promise<MarketplaceListing> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.walletAddress) throw new BadRequestException('Link a BSC wallet before listing');

    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) throw new BadRequestException('Deadline must be in the future');

    // BanditMarket.sol tracks used nonces strictly per-seller across all their orders
    const lastListing = await this.listingRepo.findOne({
      where: { sellerId: userId },
      order: { nonce: 'DESC' },
    });
    const nonce = (lastListing?.nonce ?? -1) + 1;

    this.verifyNFTEip712Sig(user.walletAddress, dto, nonce);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Find an available dog of this breed in storage (not guarding and not already listed)
      const availableDog = await qr.manager.findOne(NftGuardDog, {
        where: {
          ownerId: userId,
          tokenId: dto.tokenId,
          source: 'nft',
          isActive: true,
          isGuarding: false,
          listingId: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!availableDog) {
        const guardingCount = await qr.manager.count(NftGuardDog, {
          where: { ownerId: userId, tokenId: dto.tokenId, source: 'nft', isActive: true, isGuarding: true },
        });
        const listedCount = await qr.manager.count(NftGuardDog, {
          where: { ownerId: userId, tokenId: dto.tokenId, source: 'nft', isActive: true, listingId: Not(IsNull()) },
        });

        if (guardingCount > 0 && listedCount === 0) {
          throw new BadRequestException({
            error: 'DOG_IS_GUARDING',
            message: 'All your dogs of this breed are currently guarding the farm. Move one to storage first in Storage → Dog Kennel to sell it.',
          });
        }
        if (listedCount > 0) {
          throw new BadRequestException({
            error: 'ALL_STORED_DOGS_LISTED',
            message: `All available stored dogs of this breed are already listed (${listedCount}). Cancel an existing listing or move more dogs to storage first.`,
          });
        }
        throw new BadRequestException('You do not own any dogs of this breed in storage to sell.');
      }

      const listing = await qr.manager.save(
        MarketplaceListing,
        qr.manager.create(MarketplaceListing, {
          sellerId: userId,
          assetType: 'nft',
          nftContract: dto.nftContract,
          tokenId: dto.tokenId,
          quantity: dto.amount ?? 1,
          priceFarm: dto.priceFarm,
          deadline,
          nonce,
          eip712Sig: dto.eip712Sig,
          status: 'active',
        }),
      );

      // Link dog to this listing and ensure it cannot guard while listed
      await qr.manager.update(NftGuardDog, { id: availableDog.id }, {
        listingId: listing.id,
        isGuarding: false,
      });

      await qr.commitTransaction();
      return listing;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── user_items listing ────────────────────────────────────────────────────────

  async createItemListing(userId: string, dto: CreateItemListingDto): Promise<MarketplaceListing> {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) throw new BadRequestException('Deadline must be in the future');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const item = await qr.manager
        .createQueryBuilder(UserItem, 'i')
        .where('i.user_id = :userId AND i.item_type = :type', { userId, type: dto.itemType })
        .setLock('pessimistic_write')
        .getOne();

      if (!item) throw new NotFoundException(`No ${dto.itemType} in inventory`);

      const available = item.quantity - item.lockedQuantity;
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Not enough ${dto.itemType}. Available (unlocked): ${available}, trying to list: ${dto.quantity}`,
        );
      }

      const existing = await qr.manager.findOne(MarketplaceListing, {
        where: { sellerId: userId, itemType: dto.itemType, status: 'active' },
      });
      if (existing) {
        throw new BadRequestException(`Already have an active listing for ${dto.itemType}. Cancel it first.`);
      }

      await qr.manager.increment(UserItem, { userId, itemType: dto.itemType }, 'lockedQuantity', dto.quantity);

      const pricePerUnit = dto.priceFarm / dto.quantity;
      const listing = await qr.manager.save(MarketplaceListing, qr.manager.create(MarketplaceListing, {
        sellerId: userId,
        assetType: 'user_items',
        itemType: dto.itemType,
        quantity: dto.quantity,
        priceFarm: dto.priceFarm,
        pricePerUnit,
        deadline,
        nonce: 0,
        eip712Sig: dto.eip712Sig ?? null,
        status: 'active',
      }));

      await qr.commitTransaction();
      return listing;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getListings(query: GetListingsQueryDto = {}) {
    const {
      assetType, itemType, limit = 20, offset = 0,
      sortBy = 'createdAt', order = 'DESC',
      minPrice, maxPrice,
    } = query ?? {};
    const now = new Date();

    const qb = this.listingRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.seller', 'seller')
      .where('l.status = :status', { status: 'active' })
      .andWhere('l.deadline > :now', { now });

    if (assetType) qb.andWhere('l.asset_type = :assetType', { assetType });
    if (itemType)  qb.andWhere('l.item_type = :itemType', { itemType });
    if (minPrice != null) qb.andWhere('l.price_farm >= :minPrice', { minPrice });
    if (maxPrice != null) qb.andWhere('l.price_farm <= :maxPrice', { maxPrice });

    // Sort mapping — ENTITY PROPERTY names, never DB column names.
    //
    // `where('l.asset_type = :x')` is emitted as raw SQL so a column name works there.
    // orderBy is different: with take()/skip() TypeORM runs a two-phase query
    // (SELECT DISTINCT id ... WHERE id IN (...)) and resolves every order key back to a
    // selected alias. A column name matches no entity property, so it dereferences an
    // undefined metadata entry and throws "Cannot read properties of undefined (reading
    // 'databaseName')" — this 500'd every listings request. `deadline` only worked by
    // coincidence (property and column share a name); `price` and `createdAt` did not.
    //
    // Typed over the DTO's own union instead of `Record<string, …>`: adding a new sort
    // option to GetListingsQueryDto now fails compilation until it is mapped here, rather
    // than silently falling back to createdAt at runtime. The `?? 'createdAt'` stays as a
    // runtime guard for callers that bypass validation (internal callers passing a plain
    // object), because an unmatched key would otherwise interpolate the literal string
    // "l.undefined" into ORDER BY — the same crash this block exists to prevent.
    const SORT_COLUMNS: Record<
      NonNullable<GetListingsQueryDto['sortBy']>,
      'priceFarm' | 'createdAt' | 'deadline'
    > = {
      price:     'priceFarm',
      createdAt: 'createdAt',
      deadline:  'deadline',
    };
    qb.orderBy(`l.${SORT_COLUMNS[sortBy] ?? 'createdAt'}`, order);

    // A public browse endpoint must never 500. The two operational cases that used to
    // surface as an unhandled exception are: the table not yet existing on a fresh
    // database (relation "marketplace_listings" does not exist, i.e. migrations pending)
    // and an empty result set. Neither is something the caller can act on, and both are
    // correctly represented as "no listings available" rather than an error.
    let total: number;
    let listings: MarketplaceListing[];
    try {
      total = await qb.getCount();

      // limit/offset (plain SQL LIMIT/OFFSET) rather than take/skip.
      //
      // take/skip exists to DEDUPLICATE parent rows when a to-many join multiplies them,
      // and TypeORM implements it as the two-phase DISTINCT query that re-resolves every
      // ORDER BY key against the selected aliases — the exact path
      // (createOrderByCombinedWithSelectExpression) that threw "Cannot read properties of
      // undefined (reading 'databaseName')". The only join here is `l.seller`, a
      // ManyToOne, so a listing can never be duplicated: the dedup pass buys nothing and
      // plain LIMIT/OFFSET never enters that code path at all. If a OneToMany join is ever
      // added to this query, switch back to take/skip AND keep the ORDER BY keys as entity
      // property names.
      listings = await qb.limit(limit).offset(offset).getMany();
    } catch (err) {
      // Logged loudly on purpose: an empty marketplace and a broken query look identical
      // to the client, so this line is the only way to tell them apart in production.
      this.logger.error(`getListings query failed: ${(err as Error).message}`);
      return { total: 0, offset, limit, items: [] };
    }

    return {
      total,
      offset,
      limit,
      items: listings.map((l) => ({
        id: l.id,
        assetType: l.assetType,
        seller: l.seller?.username ?? 'Unknown',
        sellerId: l.sellerId,
        nftContract: l.nftContract,
        tokenId: l.tokenId,
        itemType: l.itemType,
        quantity: Number(l.quantity),
        pricePerUnit: l.pricePerUnit ? Number(l.pricePerUnit) : null,
        priceFarm: Number(l.priceFarm),
        deadline: l.deadline,
        createdAt: l.createdAt,
        eip712Sig: l.eip712Sig,
        nonce: l.nonce,
        status: l.status,
      })),
    };
  }

  async getMyListings(userId: string) {
    // Opportunistically reconcile any expired listings so locked quantities are immediately restored
    await this.expireListings().catch((err) => {
      this.logger.warn(`expireListings error in getMyListings: ${err.message}`);
    });

    const listings = await this.listingRepo.find({
      where: { sellerId: userId },
      relations: ['seller'],
      order: { createdAt: 'DESC' },
    });
    return listings.map((l) => ({
      id: l.id,
      assetType: l.assetType,
      seller: l.seller?.username ?? 'You',
      sellerId: l.sellerId,
      nftContract: l.nftContract,
      tokenId: l.tokenId,
      itemType: l.itemType,
      quantity: Number(l.quantity),
      pricePerUnit: l.pricePerUnit ? Number(l.pricePerUnit) : null,
      priceFarm: Number(l.priceFarm),
      deadline: l.deadline,
      createdAt: l.createdAt,
      eip712Sig: l.eip712Sig,
      nonce: l.nonce,
      status: l.status,
    }));
  }

  async cancelListing(userId: string, listingId: string) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    if (listing.status !== 'active') throw new BadRequestException('Listing is not active');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(MarketplaceListing, listingId, { status: 'cancelled' });

      if (listing.assetType === 'user_items' && listing.itemType) {
        const unlockQty = Math.floor(Number(listing.quantity));
        await qr.manager.query(
          `UPDATE user_items
           SET locked_quantity = GREATEST(0, locked_quantity - $1)
           WHERE user_id = $2 AND item_type = $3`,
          [unlockQty, userId, listing.itemType],
        );
      } else if (listing.assetType === 'nft') {
        await qr.manager.update(NftGuardDog, { listingId: listing.id }, { listingId: null });
      }

      await qr.commitTransaction();
      return { message: 'Listing cancelled' };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async buyListing(buyerId: string, listingId: string) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, status: 'active' },
      relations: ['seller'],
    });
    if (!listing) throw new NotFoundException('Listing not found or not active');
    if (listing.sellerId === buyerId) throw new BadRequestException('Cannot buy your own listing');
    if (new Date() > listing.deadline) {
      await this.listingRepo.update(listingId, { status: 'cancelled' });
      throw new BadRequestException('Listing has expired');
    }

    if (listing.assetType === 'nft') {
      const buyer = await this.userRepo.findOne({ where: { id: buyerId } });
      if (!buyer?.walletAddress) throw new BadRequestException('Link a BSC wallet to buy NFTs');

      // Mark intent — actual settlement happens via NFTOrderFilled event
      await this.listingRepo.update(listingId, { buyerId });
      return {
        message: 'Order matched. Call buyNFT() on-chain to complete transfer.',
        assetType: 'nft',
        fn: 'buyNFT',
        order: {
          seller:      listing.seller.walletAddress,
          nftContract: listing.nftContract,
          tokenId:     listing.tokenId,
          amount:      1,
          priceFarm:   ethers.parseEther(String(listing.priceFarm)).toString(),
          nonce:       listing.nonce,
          deadline:    Math.floor(listing.deadline.getTime() / 1000),
          signature:   listing.eip712Sig,
        },
        contractAddress: this.config.get<string>('web3.marketContractAddress') ?? '',
      };
    }

    // ── user_items: Instant in-game settlement with GOLD ──
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const liveListing = await qr.manager
        .createQueryBuilder(MarketplaceListing, 'l')
        .where('l.id = :id AND l.status = :status', { id: listingId, status: 'active' })
        .setLock('pessimistic_write')
        .getOne();

      if (!liveListing) throw new BadRequestException('Listing is no longer available');
      if (new Date() > liveListing.deadline) {
        await qr.manager.update(MarketplaceListing, listingId, { status: 'cancelled' });
        throw new BadRequestException('Listing has expired');
      }

      const buyer = await qr.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: buyerId })
        .setLock('pessimistic_write')
        .getOne();
      if (!buyer) throw new NotFoundException('Buyer not found');

      const priceGold = Number(liveListing.priceFarm);
      if (buyer.goldBalance < priceGold) {
        throw new BadRequestException(
          `Not enough GOLD. Price is ${priceGold.toLocaleString()} GOLD, but you only have ${Math.floor(buyer.goldBalance).toLocaleString()} GOLD.`,
        );
      }

      const sellerItem = await qr.manager
        .createQueryBuilder(UserItem, 'i')
        .where('i.user_id = :sellerId AND i.item_type = :itemType', {
          sellerId: liveListing.sellerId,
          itemType: liveListing.itemType,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!sellerItem || sellerItem.quantity < liveListing.quantity) {
        throw new BadRequestException('Seller no longer possesses this item');
      }

      // Transfer GOLD: buyer -> seller
      await qr.manager.decrement(User, { id: buyerId }, 'goldBalance', priceGold);
      await qr.manager.increment(User, { id: liveListing.sellerId }, 'goldBalance', priceGold);

      const itemQty = Math.floor(Number(liveListing.quantity));

      // Transfer ITEM: seller -> buyer
      await qr.manager.query(
        `UPDATE user_items
         SET quantity = GREATEST(0, quantity - $1),
             locked_quantity = GREATEST(0, locked_quantity - $1)
         WHERE user_id = $2 AND item_type = $3`,
        [itemQty, liveListing.sellerId, liveListing.itemType],
      );

      await qr.manager.query(
        `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (user_id, item_type)
         DO UPDATE SET quantity = user_items.quantity + $3`,
        [buyerId, liveListing.itemType, itemQty],
      );

      // Mark listing filled
      await qr.manager.update(MarketplaceListing, listingId, {
        status: 'filled',
        buyerId,
        filledAt: new Date(),
      });

      await qr.commitTransaction();

      return {
        message: `Successfully bought ${liveListing.quantity}x ${liveListing.itemType} for ${priceGold} GOLD`,
        itemType: liveListing.itemType,
        quantity: Number(liveListing.quantity),
        goldSpent: priceGold,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  @Cron('* * * * *')
  async expireListings(): Promise<void> {
    const expired = await this.listingRepo.find({
      where: { status: 'active', deadline: LessThan(new Date()) },
    });

    for (const listing of expired) {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await qr.manager.update(MarketplaceListing, listing.id, { status: 'cancelled' });
        if (listing.assetType === 'user_items' && listing.itemType) {
          const unlockQty = Math.floor(Number(listing.quantity));
          await qr.manager.query(
            `UPDATE user_items
             SET locked_quantity = GREATEST(0, locked_quantity - $1)
             WHERE user_id = $2 AND item_type = $3`,
            [unlockQty, listing.sellerId, listing.itemType],
          );
        } else if (listing.assetType === 'nft') {
          await qr.manager.update(NftGuardDog, { listingId: listing.id }, { listingId: null });
        }
        await qr.commitTransaction();
      } catch (err: any) {
        this.logger.error(`expireListings failed for listing ${listing.id}: ${err.message}`);
        await qr.rollbackTransaction();
      } finally {
        await qr.release();
      }
    }
  }

  async getNextNonce(userId: string, _nftContract?: string, _tokenId?: number): Promise<{ nonce: number; marketContractAddress: string }> {
    const lastListing = await this.listingRepo.findOne({
      where: { sellerId: userId },
      order: { nonce: 'DESC' },
    });
    return {
      nonce: (lastListing?.nonce ?? -1) + 1,
      marketContractAddress: this.config.get<string>('web3.marketContractAddress') ?? '',
    };
  }

  // ── EIP-712 verification (NFT orders — BanditMarket v2) ──────────────────────

  private verifyNFTEip712Sig(sellerAddress: string, dto: CreateListingDto, nonce: number): void {
    try {
      const priceWei   = ethers.parseEther(String(dto.priceFarm));
      const deadlineTs = Math.floor(new Date(dto.deadline).getTime() / 1000);
      const chainId    = this.config.get<number>('web3.chainId') ?? 97;

      const domain = {
        name:              'BanditMarket',
        version:           '2',
        chainId,
        verifyingContract: this.config.get<string>('web3.marketContractAddress') ?? ethers.ZeroAddress,
      };
      const types = {
        NFTOrder: [
          { name: 'seller',      type: 'address' },
          { name: 'nftContract', type: 'address' },
          { name: 'tokenId',     type: 'uint256' },
          { name: 'amount',      type: 'uint256' },
          { name: 'priceFarm',   type: 'uint256' },
          { name: 'nonce',       type: 'uint256' },
          { name: 'deadline',    type: 'uint256' },
        ],
      };
      const value = {
        seller:      sellerAddress,
        nftContract: dto.nftContract,
        tokenId:     dto.tokenId,
        amount:      dto.amount ?? 1,
        priceFarm:   priceWei,
        nonce,
        deadline:    deadlineTs,
      };

      const recovered = ethers.verifyTypedData(domain, types, value, dto.eip712Sig);
      if (recovered.toLowerCase() !== sellerAddress.toLowerCase()) {
        this.logger.warn(
          `EIP-712 signature mismatch: recovered=${recovered} expected=${sellerAddress} verifyingContract=${domain.verifyingContract}`
        );
        throw new BadRequestException('Invalid EIP-712 signature — signer does not match wallet');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('EIP-712 signature verification failed');
    }
  }
}
