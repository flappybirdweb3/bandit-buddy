import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { FarmPlot } from './farm-plot.entity';

@Entity('steal_logs')
export class StealLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thief_id' })
  thiefId: string;

  @Column({ name: 'victim_id' })
  victimId: string;

  @Column({ name: 'plot_id' })
  plotId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.theftsDone)
  @JoinColumn({ name: 'thief_id' })
  thief: User;

  @ManyToOne(() => User, (user) => user.theftsReceived)
  @JoinColumn({ name: 'victim_id' })
  victim: User;

  @ManyToOne(() => FarmPlot, (plot) => plot.stealLogs)
  @JoinColumn({ name: 'plot_id' })
  plot: FarmPlot;
}
