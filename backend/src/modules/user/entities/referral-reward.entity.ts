import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type ReferralRewardType = 'magnifying_glass' | 'master_key' | 'world_tree_boost';

@Entity('referral_rewards')
@Index(['referrerId', 'rewardType'])
export class ReferralReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id' })
  referrerId: string;

  @Column({ type: 'varchar', length: 50, name: 'reward_type' })
  rewardType: ReferralRewardType;

  @Column({ name: 'referred_user_id', type: 'uuid', nullable: true })
  referredUserId: string | null;

  @Column({ type: 'int', default: 1, name: 'milestone_count' })
  milestoneCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User | null;
}
