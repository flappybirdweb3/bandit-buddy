import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Guild } from './guild.entity';

@Entity('tree_contributions')
@Unique(['guildId', 'userId'])
export class TreeContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'guild_id' })
  guildId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'int', default: 0, name: 'water_count' })
  waterCount: number;

  @Column({ type: 'int', default: 0, name: 'invited_count' })
  invitedCount: number;

  @Column({ type: 'int', default: 0, name: 'calculated_points' })
  calculatedPoints: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_watered_at' })
  lastWateredAt: Date | null;

  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Guild, (g) => g.contributions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
