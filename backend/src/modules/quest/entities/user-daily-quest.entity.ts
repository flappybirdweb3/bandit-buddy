import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QuestDefinition } from './quest-definition.entity';

@Entity('user_daily_quests')
@Unique(['userId', 'questDefId', 'questDate'])
export class UserDailyQuest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'quest_def_id' })
  questDefId: string;

  @Column({ type: 'varchar', length: 10, name: 'quest_date' })
  questDate: string; // 'YYYY-MM-DD'

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  progress: number;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => QuestDefinition, (d) => d.userQuests, { eager: true })
  @JoinColumn({ name: 'quest_def_id' })
  questDef: QuestDefinition;
}
