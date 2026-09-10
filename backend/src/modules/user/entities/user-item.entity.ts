import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';

export type ItemType = 'magnifying_glass' | 'master_key' | 'scarecrow' | 'sprinkler';

@Entity('user_items')
@Unique(['userId', 'itemType'])
export class UserItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, name: 'item_type' })
  itemType: ItemType;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
