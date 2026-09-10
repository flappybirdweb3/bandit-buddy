import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';

const MAX_FERT_NORMAL   = 10;
const MAX_FERT_SUPER    = 5;
const MAX_FERT_ADVANCED = 3;
const MAX_ENERGY        = 100;

// Ordered tier list — index = tier rank (lower = weaker)
const GUARD_PET_TIERS = [
  'dog_stray', 'dog_beagle', 'dog_husky', 'dog_shepherd', 'elephant',
  // legacy types kept for backward compat
  'guard_pup', 'guard_hound',
] as const;

type GuardPetType = typeof GUARD_PET_TIERS[number];

const NEW_PET_TYPES = new Set(['dog_stray', 'dog_beagle', 'dog_husky', 'dog_shepherd', 'elephant']);

function isGuardPet(effectType: string): effectType is GuardPetType {
  return GUARD_PET_TIERS.includes(effectType as GuardPetType);
}

function petTierRank(type: string): number {
  const idx = GUARD_PET_TIERS.indexOf(type as GuardPetType);
  return idx === -1 ? -1 : idx;
}

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ShopItem)
    private readonly itemRepo: Repository<ShopItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NftGuardDog)
    private readonly dogRepo: Repository<NftGuardDog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Catalog + user ownership info ────────────────────────────────
  async getItems(userId: string) {
    const [items, user, activeDogs] = await Promise.all([
      this.itemRepo.find({ order: { sortOrder: 'ASC' } }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.dogRepo.find({ where: { ownerId: userId, isActive: true } }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    // Current active pet (highest defense_power wins if multiple legacy dogs)
    const currentPet = activeDogs.length > 0
      ? activeDogs.reduce((best, d) => d.defensePower > best.defensePower ? d : best)
      : null;
    const currentPetType   = currentPet?.dogType ?? null;
    const currentPetRank   = currentPetType ? petTierRank(currentPetType) : -1;
    const currentPetDefense = currentPet?.defensePower ?? 0;

    const totalFertCharges =
      (user.normalFertCharges ?? 0) + (user.superFertCharges ?? 0) + (user.advancedFertCharges ?? 0);

    return {
      goldBalance:          Number(user.goldBalance),
      fertilizerCharges:    totalFertCharges,
      normalFertCharges:    user.normalFertCharges ?? 0,
      superFertCharges:     user.superFertCharges  ?? 0,
      advancedFertCharges:  user.advancedFertCharges ?? 0,
      currentPetType,
      currentPetDefense,
      items: items.map((item) => {
        let owned    = 0;
        let maxOwned = null as number | null;
        let soldOut  = false;

        if (isGuardPet(item.effectType)) {
          const isActivePet = item.effectType === currentPetType;
          const itemRank    = petTierRank(item.effectType);
          owned    = isActivePet ? 1 : 0;
          maxOwned = 1;
          // "soldOut" = currently active (already own it). Weaker pets are shown differently in frontend.
          soldOut  = isActivePet;
        } else if (item.effectType === 'fertilizer_normal') {
          owned    = user.normalFertCharges ?? 0;
          maxOwned = MAX_FERT_NORMAL;
          soldOut  = (user.normalFertCharges ?? 0) >= MAX_FERT_NORMAL;
        } else if (item.effectType === 'fertilizer_super') {
          owned    = user.superFertCharges ?? 0;
          maxOwned = MAX_FERT_SUPER;
          soldOut  = (user.superFertCharges ?? 0) >= MAX_FERT_SUPER;
        } else if (item.effectType === 'fertilizer_advanced') {
          owned    = user.advancedFertCharges ?? 0;
          maxOwned = MAX_FERT_ADVANCED;
          soldOut  = (user.advancedFertCharges ?? 0) >= MAX_FERT_ADVANCED;
        }

        return {
          id:          item.id,
          category:    item.category,
          name:        item.name,
          description: item.description,
          effectType:  item.effectType,
          effectValue: item.effectValue,
          costGold:    Number(item.costGold),
          iconKey:     item.iconKey,
          owned,
          maxOwned,
          soldOut,
        };
      }),
    };
  }

  // ── Buy an item ───────────────────────────────────────────────────
  async buyItem(userId: string, itemId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const item = await qr.manager.findOne(ShopItem, { where: { id: itemId } });
      if (!item) throw new NotFoundException('Item not found');

      const user = await qr.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!user) throw new NotFoundException('User not found');

      const cost = Number(item.costGold);
      if (Number(user.goldBalance) < cost) {
        throw new BadRequestException(`Not enough GOLD. Need ${cost}G, have ${Number(user.goldBalance).toFixed(0)}G`);
      }

      // ── Guard pet logic ───────────────────────────────────────────
      let resultMsg = '';

      if (isGuardPet(item.effectType)) {
        const existingDogs = await qr.manager.find(NftGuardDog, {
          where: { ownerId: userId, isActive: true },
        });

        const currentPet = existingDogs.length > 0
          ? existingDogs.reduce((best, d) => d.defensePower > best.defensePower ? d : best)
          : null;

        const itemRank    = petTierRank(item.effectType);
        const currentRank = currentPet ? petTierRank(currentPet.dogType) : -1;

        if (currentPet && item.effectType === currentPet.dogType) {
          throw new BadRequestException(`${item.name} is already your active guard pet.`);
        }

        if (currentPet && itemRank < currentRank) {
          throw new BadRequestException(
            `You already have a stronger guard pet (${currentPet.dogType.replace('_', ' ')}). Cannot downgrade.`,
          );
        }

        // Deactivate all existing shop pets (allow NFT pets to stay but override with shop pet)
        if (existingDogs.length > 0) {
          const ids = existingDogs.map((d) => d.id);
          await qr.manager
            .createQueryBuilder()
            .update(NftGuardDog)
            .set({ isActive: false })
            .where('id IN (:...ids)', { ids })
            .execute();
        }

        // Activate new pet
        await qr.manager.insert(NftGuardDog, {
          ownerId:      userId,
          tokenId:      0,
          dogType:      item.effectType,
          defensePower: item.effectValue,
          isActive:     true,
          source:       'shop',
        });

        const isUpgrade = currentPet !== null;
        resultMsg = isUpgrade
          ? `Upgraded to ${item.name}! Steal chance reduced to ${Math.max(0, 80 - item.effectValue)}%`
          : `${item.name} deployed! Thieves now have ${Math.max(0, 80 - item.effectValue)}% steal chance`;

      // ── Fertilizers ───────────────────────────────────────────────
      } else if (item.effectType === 'fertilizer_normal') {
        if ((user.normalFertCharges ?? 0) >= MAX_FERT_NORMAL)
          throw new BadRequestException(`Normal Fertilizer already at max (${MAX_FERT_NORMAL} charges).`);
        const newCharges = Math.min(MAX_FERT_NORMAL, (user.normalFertCharges ?? 0) + item.effectValue);
        await qr.manager.update(User, { id: userId }, { normalFertCharges: newCharges });
        resultMsg = `+${item.effectValue} Normal Fertilizer (${newCharges}/${MAX_FERT_NORMAL}) — −1h grow time`;

      } else if (item.effectType === 'fertilizer_super') {
        if ((user.superFertCharges ?? 0) >= MAX_FERT_SUPER)
          throw new BadRequestException(`Super Fertilizer already at max (${MAX_FERT_SUPER} charges).`);
        const newCharges = Math.min(MAX_FERT_SUPER, (user.superFertCharges ?? 0) + item.effectValue);
        await qr.manager.update(User, { id: userId }, { superFertCharges: newCharges });
        resultMsg = `+${item.effectValue} Super Fertilizer (${newCharges}/${MAX_FERT_SUPER}) — −2.5h grow time`;

      } else if (item.effectType === 'fertilizer_advanced') {
        if ((user.advancedFertCharges ?? 0) >= MAX_FERT_ADVANCED)
          throw new BadRequestException(`Advanced Fertilizer already at max (${MAX_FERT_ADVANCED} charges).`);
        const newCharges = Math.min(MAX_FERT_ADVANCED, (user.advancedFertCharges ?? 0) + item.effectValue);
        await qr.manager.update(User, { id: userId }, { advancedFertCharges: newCharges });
        resultMsg = `+${item.effectValue} Advanced Fertilizer (${newCharges}/${MAX_FERT_ADVANCED}) — −5h grow time`;

      // ── Soil Restoration (#37) ────────────────────────────────────
      } else if (item.effectType === 'soil_restore_basic' || item.effectType === 'soil_restore_premium') {
        // Applies to ALL user's plots with low soil fertility, up to effectValue total pct
        const plots = await qr.manager
          .createQueryBuilder()
          .select(['id', 'soil_fertility'])
          .from('farm_plots', 'p')
          .where('p.user_id = :uid', { uid: userId })
          .andWhere('p.soil_fertility < 100')
          .orderBy('p.soil_fertility', 'ASC')
          .getRawMany<{ id: string; soil_fertility: number }>();

        let restored = 0;
        for (const plot of plots) {
          const canAdd = Math.min(item.effectValue, 100 - plot.soil_fertility);
          if (canAdd > 0) {
            await qr.manager.createQueryBuilder()
              .update('farm_plots')
              .set({ soil_fertility: () => `LEAST(100, "soil_fertility" + ${canAdd})` })
              .where('id = :id', { id: plot.id })
              .execute();
            restored += canAdd;
          }
          if (restored >= item.effectValue) break;
        }
        resultMsg = plots.length === 0
          ? `${item.name} used — all plots already at 100% fertility!`
          : `${item.name} applied — restored up to ${item.effectValue}% soil fertility across ${plots.length} plot(s)`;

      // ── Energy refill ──────────────────────────────────────────────
      } else if (item.effectType === 'energy') {
        const userMaxEnergy = user.maxEnergy ?? MAX_ENERGY;
        const gained = Math.min(item.effectValue, userMaxEnergy - user.energy);
        await qr.manager.createQueryBuilder()
          .update(User)
          .set({ energy: () => `LEAST("max_energy", "energy" + ${item.effectValue})` })
          .where('id = :id', { id: userId })
          .execute();
        resultMsg = `+${gained} energy restored`;

      // ── Max energy upgrade (permanent) ─────────────────────────────
      } else if (item.effectType === 'max_energy') {
        const HARD_CAP = 250;
        const currentMax = user.maxEnergy ?? MAX_ENERGY;
        if (currentMax >= HARD_CAP)
          throw new BadRequestException(`Max energy already at cap (${HARD_CAP}).`);
        const newMax = Math.min(HARD_CAP, currentMax + item.effectValue);
        // Also top up current energy to new max
        await qr.manager.update(User, { id: userId }, {
          maxEnergy: newMax,
          energy: newMax,
        });
        resultMsg = `Max energy upgraded to ${newMax} ⚡ (was ${currentMax})`;
      }

      // Deduct gold after all validations pass
      await qr.manager.decrement(User, { id: userId }, 'goldBalance', cost);
      await qr.commitTransaction();

      return { message: resultMsg, itemName: item.name, costGold: cost };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
