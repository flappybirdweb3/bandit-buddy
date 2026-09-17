import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';

// Viral tools
type ToolItemType = 'magnifying_glass' | 'master_key' | 'scarecrow' | 'sprinkler';

// Harvested crops → stored here after harvest (sell-to-system or pack into crates)
type CropItemType =
  | 'crop_wheat' | 'crop_carrot' | 'crop_corn' | 'crop_tomato' | 'crop_pumpkin'
  | 'crop_rose' | 'crop_sunflower'
  | 'crop_pumpkin_demon' | 'crop_lucky_peach';

// Packed crates — bundles of crops tradeable on Marketplace
type CrateItemType =
  | 'crate_wheat' | 'crate_carrot' | 'crate_corn' | 'crate_tomato' | 'crate_pumpkin'
  | 'crate_rose' | 'crate_sunflower'
  | 'crate_pumpkin_demon' | 'crate_lucky_peach';

// Rare/seasonal seeds tradeable on Marketplace
type SeedItemType = 'seed_rose' | 'seed_sunflower' | 'seed_pumpkin_demon' | 'seed_lucky_peach';

export type ItemType = ToolItemType | CropItemType | CrateItemType | SeedItemType;

@Entity('user_items')
@Unique(['userId', 'itemType'])
export class UserItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100, name: 'item_type' })
  itemType: string; // string (not ItemType) to allow future types without entity recompile

  @Column({ type: 'int', default: 0 })
  quantity: number;

  // Items locked by pending marketplace orders — cannot sell/pack/use while locked
  @Column({ type: 'int', default: 0, name: 'locked_quantity' })
  lockedQuantity: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
