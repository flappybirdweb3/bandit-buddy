import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, OneToMany, Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { SeedConfig } from './seed-config.entity';
import { StealLog } from './steal-log.entity';

@Entity('farm_plots')
@Index(['userId', 'plotIndex'], { unique: true })
export class FarmPlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'int', name: 'plot_index' })
  plotIndex: number;

  @Column({ name: 'seed_id', nullable: true, type: 'uuid' })
  seedId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'planted_at' })
  plantedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'harvestable_at' })
  harvestableAt: Date | null;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_stolen' })
  totalStolen: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_stolen_at' })
  lastStolenAt: Date | null;

  @Column({ type: 'int', default: 100, name: 'soil_fertility' })
  soilFertility: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0, name: 'yield_multiplier' })
  yieldMultiplier: number;

  @Column({ type: 'boolean', default: false })
  fertilized: boolean;

  @Column({ type: 'boolean', default: false, name: 'has_bugs' })
  hasBugs: boolean;

  @Column({ type: 'boolean', default: false, name: 'has_weeds' })
  hasWeeds: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'last_watered_at' })
  lastWateredAt: Date | null;

  @ManyToOne(() => User, (user) => user.farmPlots)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SeedConfig, (seed) => seed.farmPlots, { eager: true, nullable: true })
  @JoinColumn({ name: 'seed_id' })
  seed: SeedConfig | null;

  @OneToMany(() => StealLog, (log) => log.plot)
  stealLogs: StealLog[];
}
