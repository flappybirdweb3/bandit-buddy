import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type SubType = 'butler' | 'insurance' | 'dog_feeding';

@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, name: 'sub_type' })
  subType: SubType;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  get isActive(): boolean {
    return this.expiresAt > new Date();
  }
}
