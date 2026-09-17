import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { SeedConfig } from '../../farm/entities/seed-config.entity';

export type SubscriptionType = 'butler' | 'crop_insurance';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 30 })
  type: SubscriptionType;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'uuid', name: 'preferred_seed_id', nullable: true })
  preferredSeedId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SeedConfig, { nullable: true })
  @JoinColumn({ name: 'preferred_seed_id' })
  preferredSeed?: SeedConfig | null;

  get isActive(): boolean {
    return this.expiresAt > new Date();
  }
}
