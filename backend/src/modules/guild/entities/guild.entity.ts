import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, OneToMany, CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { GuildMember } from './guild-member.entity';

export type GuildTier = 'free' | 'elite';

@Entity('guilds')
export class Guild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  tier: GuildTier;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, name: 'staked_farm' })
  stakedFarm: number;

  /** 1–5% harvest tax (Elite only) */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0, name: 'tax_rate' })
  taxRate: number;

  @Column({ type: 'int', default: 1000, name: 'world_tree_hp' })
  worldTreeHp: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => GuildMember, (m) => m.guild)
  members: GuildMember[];

  get isElite(): boolean {
    return this.tier === 'elite';
  }
}
