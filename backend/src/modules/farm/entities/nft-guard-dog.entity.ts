import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('nft_guard_dogs')
export class NftGuardDog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'int', name: 'token_id' })
  tokenId: number;

  @Column({ type: 'varchar', length: 50, name: 'dog_type' })
  dogType: string;

  @Column({ type: 'int', default: 0, name: 'defense_power' })
  defensePower: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 20, default: 'nft' })
  source: string; // 'nft' | 'shop'

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'last_fed_at' })
  lastFedAt: Date;

  @ManyToOne(() => User, (user) => user.guardDogs)
  @JoinColumn({ name: 'owner_id' })
  owner: User;
}
