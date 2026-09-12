import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
  OnModuleInit, OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
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

// BanditMarket v2 ABI — matches deployed contract events exactly
const BANDIT_MARKET_ABI = [
  'event NFTOrderFilled(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 amount, uint256 priceFarm, uint256 fee)',
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
    const primary = this.config.get<string>('web3.bscRpcUrl') ?? 'https://bsc-dataseed1.binance.org/';
    const chainId = this.config.get<number>('web3.chainId') ?? 56;
    const fallbacks = chainId === 97
      ? ['https://bsc-testnet-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/bsc/testnet/public']
      : ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'];

    this.provider = new ethers.FallbackProvider(
      [primary, ...fallbacks].map((url, i) => ({
        provider: new ethers.JsonRpcProvider(url),
        priority: i + 1,
        stallTimeout: 2000,
        weight: 1,
      })),
      undefined,
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
          const txHash = event.log?.transactionHash ?? '';
          await this.handleNFTOrderFilled(txHash, seller, buyer, nftContract, Number(tokenId));
        } catch (err: any) {
          this.logger.error(`NFTOrderFilled handler: ${err.message}`);
        }
      });

      this.wssContract.on('OffchainItemSold', async (buyer, seller, itemType, quantity, _p, _f, nonce, event) => {
        try {
          const txHash = event.log?.transactionHash ?? '';
          await this.handleOffchainItemSold(txHash, buyer, seller, itemType, Number(quantity), Number(nonce));
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

  // ── NFTOrderFilled handler (Guard Dogs) ──────────────────────────────────────

  private async handleNFTOrderFilled(
    txHash: string, _seller: string, _buyer: string, nftContract: string, tokenId: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Atomic idempotency: INSERT ... ON CONFLICT DO NOTHING
      // rowCount = 0 means already processed → skip
      const result: any = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, event_type)
         VALUES ($1, 'NFTOrderFilled')
         ON CONFLICT (tx_hash) DO NOTHING`,
        [txHash],
      );
      if (result.rowCount === 0) {
        this.logger.debug(`NFTOrderFilled already processed: ${txHash}`);
        return;
      }

      const listing = await manager
        .createQueryBuilder(MarketplaceListing, 'l')
        .where('l.nft_contract = :nftContract AND l.token_id = :tokenId AND l.status = :status', {
          nftContract, tokenId, status: 'active',
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!listing) {
        this.logger.warn(`NFTOrderFilled: no active listing nftContract=${nftContract} tokenId=${tokenId}`);
        return;
      }

      await manager.update(MarketplaceListing, listing.id, {
        status: 'filled', filledAt: new Date(), txHash,
      });

      this.logger.log(`NFTOrderFilled: tokenId=${tokenId} tx=${txHash}`);
    });
  }

  // ── OffchainItemSold handler (Crates / Kính Lúp / Master Key) ───────────────

  private async handleOffchainItemSold(
    txHash: string, buyerWallet: string, sellerWallet: string,
    itemType: string, quantity: number, nonce: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Atomic idempotency
      const result: any = await manager.query(
        `INSERT INTO processed_onchain_txs (tx_hash, event_type)
         VALUES ($1, 'OffchainItemSold')
         ON CONFLICT (tx_hash) DO NOTHING`,
        [txHash],
      );
      if (result.rowCount === 0) {
        this.logger.debug(`OffchainItemSold already processed: ${txHash}`);
        return;
      }

      // Resolve seller and buyer by wallet address
      const seller = await manager.findOne(User, {
        where: { walletAddress: sellerWallet.toLowerCase() },
      });
      if (!seller) {
        this.logger.warn(`OffchainItemSold: seller wallet ${sellerWallet} not registered`);
        return;
      }
      const buyer = await manager.findOne(User, {
        where: { walletAddress: buyerWallet.toLowerCase() },
      });
      if (!buyer) {
        this.logger.warn(`OffchainItemSold: buyer wallet ${buyerWallet} not registered`);
        return;
      }

      // Find active listing (lock row)
      const listing = await manager
        .createQueryBuilder(MarketplaceListing, 'l')
        .where('l.seller_id = :sellerId AND l.item_type = :itemType AND l.status = :status', {
          sellerId: seller.id, itemType, status: 'active',
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!listing) {
        this.logger.warn(`OffchainItemSold: no active listing for ${itemType} from ${sellerWallet} nonce=${nonce}`);
        return;
      }

      // Transfer item: deduct from seller, add to buyer
      await manager.query(
        `UPDATE user_items
         SET quantity        = quantity        - $1,
             locked_quantity = locked_quantity - $1
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

      this.logger.log(`OffchainItemSold: ${itemType} ×${quantity} → ${buyerWallet} tx=${txHash}`);
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

        const [nftEvents, offchainEvents] = await Promise.all([
          this.marketContract.queryFilter(this.marketContract.filters.NFTOrderFilled(), start, end),
          this.marketContract.queryFilter(this.marketContract.filters.OffchainItemSold(), start, end),
        ]);

        for (const ev of nftEvents) {
          if (!('args' in ev)) continue;
          const { buyer, seller, nftContract, tokenId } = (ev as ethers.EventLog).args;
          await this.handleNFTOrderFilled(ev.transactionHash, seller, buyer, nftContract, Number(tokenId));
        }

        for (const ev of offchainEvents) {
          if (!('args' in ev)) continue;
          const { buyer, seller, itemType, quantity, nonce } = (ev as ethers.EventLog).args;
          await this.handleOffchainItemSold(ev.transactionHash, buyer, seller, itemType, Number(quantity), Number(nonce));
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

    const guardingDog = await this.dataSource.manager.findOne(NftGuardDog, {
      where: { ownerId: userId, tokenId: dto.tokenId, source: 'nft', isActive: true, isGuarding: true },
    });
    if (guardingDog) {
      throw new BadRequestException({
        error: 'DOG_IS_GUARDING',
        message: 'Cannot sell a dog that is currently guarding the farm. Unequip it first in Nhà Kho → Chuồng Chó.',
      });
    }

    const lastListing = await this.listingRepo.findOne({
      where: { sellerId: userId, nftContract: dto.nftContract, tokenId: dto.tokenId },
      order: { nonce: 'DESC' },
    });
    const nonce = (lastListing?.nonce ?? -1) + 1;

    this.verifyNFTEip712Sig(user.walletAddress, dto, nonce);

    const existing = await this.listingRepo.findOne({
      where: { nftContract: dto.nftContract, tokenId: dto.tokenId, status: 'active' },
    });
    if (existing) throw new BadRequestException('An active listing already exists for this NFT. Cancel it first.');

    return this.listingRepo.save(this.listingRepo.create({
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
    }));
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
    } = query;
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

    // Sort mapping
    const sortCol: Record<string, string> = {
      price:     'l.price_farm',
      createdAt: 'l.created_at',
      deadline:  'l.deadline',
    };
    qb.orderBy(sortCol[sortBy] ?? 'l.created_at', order);

    const total = await qb.getCount();
    const listings = await qb.take(limit).skip(offset).getMany();

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
      })),
    };
  }

  async getMyListings(userId: string) {
    return this.listingRepo.find({
      where: { sellerId: userId },
      order: { createdAt: 'DESC' },
    });
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
        await qr.manager.query(
          `UPDATE user_items
           SET locked_quantity = GREATEST(0, locked_quantity - $1)
           WHERE user_id = $2 AND item_type = $3`,
          [listing.quantity, userId, listing.itemType],
        );
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

    const buyer = await this.userRepo.findOne({ where: { id: buyerId } });
    if (!buyer?.walletAddress) throw new BadRequestException('Link a BSC wallet to buy');

    if (listing.assetType === 'nft') {
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

    // user_items: return order data for buyOffchainItem() on-chain.
    // Settlement will be handled by handleOffchainItemSold() after the event fires.
    await this.listingRepo.update(listingId, { buyerId });
    return {
      message: 'Order matched. Call buyOffchainItem() on-chain to complete purchase.',
      assetType: 'user_items',
      fn: 'buyOffchainItem',
      order: {
        seller:    listing.seller.walletAddress,
        itemType:  listing.itemType,
        quantity:  Number(listing.quantity),
        priceFarm: ethers.parseEther(String(listing.priceFarm)).toString(),
        nonce:     listing.nonce,
        deadline:  Math.floor(listing.deadline.getTime() / 1000),
        signature: listing.eip712Sig,
      },
      contractAddress: this.config.get<string>('web3.marketContractAddress') ?? '',
    };
  }

  @Cron('0 * * * *')
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
          await qr.manager.query(
            `UPDATE user_items
             SET locked_quantity = GREATEST(0, locked_quantity - $1)
             WHERE user_id = $2 AND item_type = $3`,
            [listing.quantity, listing.sellerId, listing.itemType],
          );
        }
        await qr.commitTransaction();
      } catch {
        await qr.rollbackTransaction();
      } finally {
        await qr.release();
      }
    }
  }

  async getNextNonce(userId: string, nftContract: string, tokenId: number): Promise<{ nonce: number }> {
    const lastListing = await this.listingRepo.findOne({
      where: { sellerId: userId, nftContract, tokenId },
      order: { nonce: 'DESC' },
    });
    return { nonce: (lastListing?.nonce ?? -1) + 1 };
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
        throw new BadRequestException('Invalid EIP-712 signature — signer does not match wallet');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('EIP-712 signature verification failed');
    }
  }
}
