import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { FarmPlot } from './farm-plot.entity';

@Entity('seed_configs')
export class SeedConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'cost_gold' })
  costGold: number;

  @Column({ type: 'int', name: 'grow_time_sec' })
  growTimeSec: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'base_yield' })
  baseYield: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'icon_key' })
  iconKey: string;

  @Column({ type: 'int', default: 0, name: 'level_required' })
  levelRequired: number;

  @Column({ type: 'varchar', length: 20, default: 'root' })
  category: string;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0, name: 'grow_time_hours' })
  growTimeHours: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'name_vi' })
  nameVi: string;

  @Column({ type: 'boolean', default: false, name: 'is_seasonal' })
  isSeasonal: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'seasonal_tag' })
  seasonalTag: string | null;

  @OneToMany(() => FarmPlot, (plot) => plot.seed)
  farmPlots: FarmPlot[];
}
