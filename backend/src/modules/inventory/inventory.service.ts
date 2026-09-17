import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThan } from 'typeorm';
import { UserItem } from '../user/entities/user-item.entity';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { MarketplaceListing } from '../marketplace/entities/marketplace-listing.entity';
import { SellCropsDto, PackCrateDto, UnpackCrateDto, CRATE_PACK_SIZE, CropKey } from './dto/inventory.dto';
import { GuildService } from '../guild/guild.service';

const GOLD_PER_CROP_UNIT = 1;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(UserItem)
    private readonly itemRepo: Repository<UserItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NftGuardDog)
    private readonly dogRepo: Repository<NftGuardDog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly guildService: GuildService,
  ) {}

  async getInventory(userId: string) {
    const items = await this.itemRepo.find({ where: { userId } });
    return items.map((i) => ({
      itemType: i.itemType,
      quantity: i.quantity,
      lockedQuantity: i.lockedQuantity,
      available: i.quantity - i.lockedQuantity,
    }));
  }

  /** Sell crop items to system for GOLD at 1:1 rate. */
  async sellCrops(userId: string, dto: SellCropsDto) {
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
          `Not enough ${dto.itemType}. Available: ${available}, needed: ${dto.quantity}`,
        );
      }

      const goldGained = dto.quantity * GOLD_PER_CROP_UNIT;
      const taxPaid = await this.guildService.applyGuildHarvestTax(userId, goldGained).catch(() => 0);
      const netGold = Math.max(0, goldGained - taxPaid);

      await qr.manager.decrement(UserItem, { userId, itemType: dto.itemType }, 'quantity', dto.quantity);
      await qr.manager.increment(User, { id: userId }, 'goldBalance', netGold);
      await qr.manager.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'HARVEST_SELL', $3)`,
        [userId, netGold, `Sold ${dto.quantity} ${dto.itemType}${taxPaid > 0 ? ` (Tax: ${taxPaid} GOLD to Guild)` : ''}`],
      ).catch(() => {});
      await qr.commitTransaction();

      return {
        message: `Sold ${dto.quantity} ${dto.itemType} for ${netGold} GOLD${taxPaid > 0 ? ` (${taxPaid}G tax to Guild)` : ''}`,
        goldGained: netGold,
        itemType: dto.itemType,
        quantitySold: dto.quantity,
        taxPaid,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Sell ALL raw crop items to system for GOLD at 1:1 rate. */
  async sellAllCrops(userId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const items = await qr.manager
        .createQueryBuilder(UserItem, 'i')
        .where('i.user_id = :userId AND i.item_type LIKE :prefix', { userId, prefix: 'crop_%' })
        .setLock('pessimistic_write')
        .getMany();

      let totalGold = 0;
      let totalSold = 0;

      for (const item of items) {
        const available = item.quantity - item.lockedQuantity;
        if (available > 0) {
          totalGold += available * GOLD_PER_CROP_UNIT;
          totalSold += available;
          await qr.manager.decrement(UserItem, { userId, itemType: item.itemType }, 'quantity', available);
        }
      }

      let totalTax = 0;
      let netGold = totalGold;
      if (totalGold > 0) {
        totalTax = await this.guildService.applyGuildHarvestTax(userId, totalGold).catch(() => 0);
        netGold = Math.max(0, totalGold - totalTax);
        await qr.manager.increment(User, { id: userId }, 'goldBalance', netGold);
        await qr.manager.query(
          `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'HARVEST_SELL', $3)`,
          [userId, netGold, `Sold ${totalSold} crops${totalTax > 0 ? ` (Tax: ${totalTax} GOLD to Guild)` : ''}`],
        ).catch(() => {});
      }

      await qr.commitTransaction();

      return {
        message: totalSold > 0
          ? `Sold ${totalSold} crops for ${netGold} GOLD${totalTax > 0 ? ` (${totalTax}G tax to Guild)` : ''}`
          : 'No crops to sell',
        goldGained: netGold,
        totalGoldGained: netGold,
        totalCropsSold: totalSold,
        taxPaid: totalTax,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Pack crop units into tradeable crates. */
  async packCrate(userId: string, dto: PackCrateDto) {
    const cropItemType = `crop_${dto.cropKey}`;
    const crateItemType = `crate_${dto.cropKey}`;
    const unitsPerCrate = CRATE_PACK_SIZE[dto.cropKey as CropKey];
    const totalUnitsNeeded = unitsPerCrate * dto.crateCount;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const item = await qr.manager
        .createQueryBuilder(UserItem, 'i')
        .where('i.user_id = :userId AND i.item_type = :type', { userId, type: cropItemType })
        .setLock('pessimistic_write')
        .getOne();

      if (!item) throw new NotFoundException(`No ${cropItemType} in inventory`);

      const available = item.quantity - item.lockedQuantity;
      if (available < totalUnitsNeeded) {
        throw new BadRequestException(
          `Need ${totalUnitsNeeded} ${cropItemType} to pack ${dto.crateCount} crate(s) (${unitsPerCrate} per crate). Have: ${available}`,
        );
      }

      // Consume crop units
      await qr.manager.decrement(UserItem, { userId, itemType: cropItemType }, 'quantity', totalUnitsNeeded);

      // Add crate(s) to inventory
      await qr.manager.query(
        `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (user_id, item_type)
         DO UPDATE SET quantity = user_items.quantity + $3`,
        [userId, crateItemType, dto.crateCount],
      );

      await qr.commitTransaction();

      return {
        message: `Packed ${dto.crateCount} ${crateItemType}(s) using ${totalUnitsNeeded} ${cropItemType}`,
        crateType: crateItemType,
        cratesCreated: dto.crateCount,
        unitsConsumed: totalUnitsNeeded,
        unitsPerCrate,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Aggregated Barn / Storage payload: items + dogs + fertilizer in one call. */
  async getBarnData(userId: string) {
    // Reconcile any expired marketplace listings for this user before returning inventory
    const expiredListings = await this.dataSource.manager.find(MarketplaceListing, {
      where: {
        sellerId: userId,
        status: 'active',
        deadline: LessThan(new Date()),
      },
    });
    if (expiredListings.length > 0) {
      for (const listing of expiredListings) {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(MarketplaceListing, listing.id, { status: 'cancelled' });
          if (listing.assetType === 'user_items' && listing.itemType) {
            const unlockQty = Math.floor(Number(listing.quantity));
            await manager.query(
              `UPDATE user_items
               SET locked_quantity = GREATEST(0, locked_quantity - $1)
               WHERE user_id = $2 AND item_type = $3`,
              [unlockQty, userId, listing.itemType],
            );
          } else if (listing.assetType === 'nft') {
            await manager.update(NftGuardDog, { listingId: listing.id }, { listingId: null });
          }
        }).catch(() => {});
      }
    }

    const [items, dogs, user] = await Promise.all([
      this.itemRepo.find({ where: { userId } }),
      this.dogRepo.find({ where: { ownerId: userId, isActive: true }, order: { defensePower: 'DESC' } }),
      this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'normalFertCharges', 'superFertCharges', 'advancedFertCharges'],
      }),
    ]);

    const toItem = (i: UserItem) => ({
      itemType: i.itemType,
      quantity: i.quantity,
      lockedQuantity: i.lockedQuantity,
      available: i.quantity - i.lockedQuantity,
    });

    const PREFIXES = ['crop_', 'crate_', 'seed_'];

    const listedIds = dogs.map(d => d.listingId).filter((id): id is string => !!id);
    const activeListings = listedIds.length > 0
      ? await this.dataSource.manager.find(MarketplaceListing, {
          where: { id: In(listedIds), status: 'active' },
        })
      : [];
    const listingPriceMap = new Map(activeListings.map(l => [l.id, Number(l.priceFarm)]));

    return {
      crops:  items.filter(i => i.itemType.startsWith('crop_')).map(toItem),
      crates: items.filter(i => i.itemType.startsWith('crate_')).map(toItem),
      seeds:  items.filter(i => i.itemType.startsWith('seed_')).map(toItem),
      tools:  items.filter(i => !PREFIXES.some(p => i.itemType.startsWith(p))).map(toItem),
      fertilizer: {
        normal:   user?.normalFertCharges   ?? 0,
        super:    user?.superFertCharges    ?? 0,
        advanced: user?.advancedFertCharges ?? 0,
        total: (user?.normalFertCharges ?? 0) + (user?.superFertCharges ?? 0) + (user?.advancedFertCharges ?? 0),
      },
      dogs: dogs.map(d => ({
        id:           d.id,
        tokenId:      d.tokenId,
        dogType:      d.dogType,
        defensePower: d.defensePower,
        isActive:     d.isActive,
        isGuarding:   d.isGuarding,
        listingId:    d.listingId ?? null,
        isListed:     !!d.listingId,
        listingPrice: d.listingId ? (listingPriceMap.get(d.listingId) ?? null) : null,
        source:       d.source as 'nft' | 'shop',
        lastFedAt:    d.lastFedAt,
      })),
    };
  }

  /** Unpack crates back into crop units. Cannot unpack locked crates. */
  async unpackCrate(userId: string, dto: UnpackCrateDto) {
    const rawKey = dto.cropKey
      ? dto.cropKey.replace('crate_', '').replace('crop_', '')
      : (dto.crateItemType ?? '').replace('crate_', '').replace('crop_', '');
    const cropKey = rawKey as CropKey;
    const cropItemType = `crop_${cropKey}`;
    const crateItemType = `crate_${cropKey}`;
    const quantity = Math.max(1, Number(dto.quantity ?? dto.crateCount ?? 1));

    const unitsPerCrate = CRATE_PACK_SIZE[cropKey];
    if (!unitsPerCrate) throw new BadRequestException(`Unknown crate type: ${dto.crateItemType || dto.cropKey}`);

    const totalUnitsGained = unitsPerCrate * quantity;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const item = await qr.manager
        .createQueryBuilder(UserItem, 'i')
        .where('i.user_id = :userId AND i.item_type = :type', { userId, type: crateItemType })
        .setLock('pessimistic_write')
        .getOne();

      if (!item) throw new NotFoundException(`No ${crateItemType} in inventory`);

      const available = item.quantity - item.lockedQuantity;
      if (available < quantity) {
        throw new BadRequestException(
          `Not enough unlocked ${crateItemType}. Available (unlocked): ${available}, needed: ${quantity}`,
        );
      }

      // Remove crates
      await qr.manager.decrement(UserItem, { userId, itemType: crateItemType }, 'quantity', quantity);

      // Return crop units
      await qr.manager.query(
        `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (user_id, item_type)
         DO UPDATE SET quantity = user_items.quantity + $3`,
        [userId, cropItemType, totalUnitsGained],
      );

      await qr.commitTransaction();

      return {
        message: `Unpacked ${quantity} ${crateItemType} → ${totalUnitsGained} ${cropItemType}`,
        crateType: crateItemType,
        cratesUnpacked: quantity,
        cropType: cropItemType,
        unitsGained: totalUnitsGained,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
