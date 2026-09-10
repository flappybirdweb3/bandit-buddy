import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserDailyQuest } from './user-daily-quest.entity';

export type QuestType =
  | 'harvest_count'
  | 'plant_count'
  | 'steal_attempts'
  | 'steal_count'
  | 'steal_gold'
  | 'harvest_gold'
  | 'attack_count'
  | 'water_count';

@Entity('quest_definitions')
export class QuestDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'quest_type' })
  questType: QuestType;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'int', name: 'target_value' })
  targetValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'reward_gold' })
  rewardGold: number;

  @Column({ type: 'int', default: 0, name: 'reward_energy' })
  rewardEnergy: number;

  @Column({ type: 'varchar', length: 50, name: 'icon_key' })
  iconKey: string;

  @OneToMany(() => UserDailyQuest, (q) => q.questDef)
  userQuests: UserDailyQuest[];
}
