import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { FarmPlot } from '../../farm/entities/farm-plot.entity';
import { StealLog } from '../../farm/entities/steal-log.entity';
import { NftGuardDog } from '../../farm/entities/nft-guard-dog.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true, name: 'telegram_id' })
  telegramId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 42, nullable: true, name: 'wallet_address' })
  walletAddress: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, name: 'gold_balance' })
  goldBalance: number;

  @Column({ type: 'int', default: 100 })
  energy: number;

  @Column({ type: 'int', default: 100, name: 'max_energy' })
  maxEnergy: number;

  @Column({ type: 'int', default: 50, name: 'trust_score' })
  trustScore: number;

  @Column({ type: 'int', default: 0 })
  nonce: number;

  @Column({ type: 'int', default: 0 })
  xp: number;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'uuid', nullable: true, name: 'referred_by' })
  referredBy: string | null;

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'last_energy_update' })
  lastEnergyUpdate: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_daily_claim' })
  lastDailyClaim: Date | null;

  @Column({ type: 'int', default: 0, name: 'daily_streak' })
  dailyStreak: number;

  @Column({ type: 'boolean', default: true, name: 'notifications_enabled' })
  notificationsEnabled: boolean;

  // Shop: 3-tier fertilizer charges (each reduces grow time)
  @Column({ type: 'int', default: 0, name: 'normal_fert_charges' })
  normalFertCharges: number;

  @Column({ type: 'int', default: 0, name: 'super_fert_charges' })
  superFertCharges: number;

  @Column({ type: 'int', default: 0, name: 'advanced_fert_charges' })
  advancedFertCharges: number;

  // Leaderboard: cumulative gold stolen from others
  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, name: 'gold_stolen' })
  goldStolen: number;

  // Achievement counters
  @Column({ type: 'int', default: 0, name: 'total_harvests' })
  totalHarvests: number;

  @Column({ type: 'int', default: 0, name: 'total_plants' })
  totalPlants: number;

  @Column({ type: 'int', default: 0, name: 'total_attacks' })
  totalAttacks: number;

  @Column({ type: 'int', default: 0, name: 'total_waters' })
  totalWaters: number;

  // Anti-bot: daily steal quota tracking
  @Column({ type: 'int', default: 0, name: 'daily_steal_count' })
  dailyStealCount: number;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'last_steal_date' })
  lastStealDate: string | null; // 'YYYY-MM-DD'

  // Anti-bot: consecutive failure tracking (for trust score decay)
  @Column({ type: 'int', default: 0, name: 'consecutive_steal_failures' })
  consecutiveStealFailures: number;

  @ManyToOne(() => User, (u) => u.referrals, { nullable: true })
  @JoinColumn({ name: 'referred_by' })
  referrer: User | null;

  @OneToMany(() => User, (u) => u.referrer)
  referrals: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => FarmPlot, (plot) => plot.user)
  farmPlots: FarmPlot[];

  @OneToMany(() => StealLog, (log) => log.thief)
  theftsDone: StealLog[];

  @OneToMany(() => StealLog, (log) => log.victim)
  theftsReceived: StealLog[];

  @OneToMany(() => NftGuardDog, (dog) => dog.owner)
  guardDogs: NftGuardDog[];
}
