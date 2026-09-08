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

  @OneToMany(() => FarmPlot, (plot) => plot.seed)
  farmPlots: FarmPlot[];
}
