import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type NotifType =
  | 'steal_victim'
  | 'dog_bite_owner'
  | 'quest_complete'
  | 'harvest_ready'
  | 'referral_joined'
  | 'master_key_unlocked'
  | 'daily_reminder'
  | 'attack_victim'
  | 'help_received'
  | 'trade_filled';

@Entity('user_notifications')
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotifType;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  body: string;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'actor_user_id' })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'actor_username' })
  actorUsername: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
