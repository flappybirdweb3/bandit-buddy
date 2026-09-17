import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, OneToMany, CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { GuildMember } from './guild-member.entity';
import { TreeContribution } from './tree-contribution.entity';

export type GuildTier = 'free' | 'elite';
export type GuildTreeStatus = 'growing' | 'ripe' | 'harvested';

@Entity('guilds')
export class Guild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  tier: GuildTier;

  @Column({ type: 'boolean', default: false, name: 'is_premium' })
  isPremium: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'telegram_group_id' })
  telegramGroupId: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, name: 'staked_farm' })
  stakedFarm: number;

  /** 1–5% harvest tax (Elite only) */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0, name: 'tax_rate' })
  taxRate: number;

  @Column({ type: 'int', default: 1000, name: 'world_tree_hp' })
  worldTreeHp: number;

  @Column({ type: 'int', default: 1, name: 'tree_level' })
  treeLevel: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'tree_progress_percent' })
  treeProgressPercent: number;

  @Column({ type: 'varchar', length: 20, default: 'growing' })
  status: GuildTreeStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'ripe_at' })
  ripeAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'shield_until' })
  shieldUntil: Date | null;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 100, name: 'reward_pool_farm' })
  rewardPoolFarm: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 2000, name: 'reward_pool_gold' })
  rewardPoolGold: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_attacked_at' })
  lastAttackedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => GuildMember, (m) => m.guild)
  members: GuildMember[];

  @OneToMany(() => TreeContribution, (tc) => tc.guild)
  contributions: TreeContribution[];

  get isElite(): boolean {
    return this.tier === 'elite' || this.isPremium;
  }

  get isShielded(): boolean {
    return !!this.shieldUntil && new Date(this.shieldUntil) > new Date();
  }
}
