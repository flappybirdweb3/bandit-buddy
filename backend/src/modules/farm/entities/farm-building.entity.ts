import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('farm_buildings')
export class FarmBuilding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'int', default: 100, name: 'fence_durability' })
  fenceDurability: number;

  @Column({ type: 'int', default: 100, name: 'barn_durability' })
  barnDurability: number;

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'last_repaired_at' })
  lastRepairedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Lazy durability calculation — no cron needed */
  getCurrentDurability(): number {
    const daysSince = (Date.now() - this.lastRepairedAt.getTime()) / 86_400_000;
    return Math.max(0, this.fenceDurability - Math.floor(daysSince * 14.3));
  }
}
