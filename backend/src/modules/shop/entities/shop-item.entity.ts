import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type ShopCategory = 'energy' | 'defense' | 'boost' | 'soil' | 'subscription' | 'upgrades';
export type EffectType =
  | 'energy'
  | 'dog_stray' | 'dog_beagle' | 'dog_husky' | 'dog_shepherd' | 'elephant'
  | 'guard_pup' | 'guard_hound'
  | 'fertilizer_normal' | 'fertilizer_super' | 'fertilizer_advanced'
  | 'soil_restore_basic' | 'soil_restore_premium'
  | 'butler_7d' | 'butler_30d' | 'crop_insurance_7d'
  | 'max_energy';

@Entity('shop_items')
export class ShopItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  category: ShopCategory;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 50, name: 'effect_type' })
  effectType: EffectType;

  @Column({ type: 'int', name: 'effect_value' })
  effectValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'cost_gold' })
  costGold: number;

  @Column({ type: 'varchar', length: 50, name: 'icon_key' })
  iconKey: string;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;
}
