import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Guild } from './guild.entity';

export type GuildRole = 'owner' | 'officer' | 'member';

@Entity('guild_members')
export class GuildMember {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn({ name: 'guild_id' })
  guildId: string;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: GuildRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Guild, (g) => g.members)
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;
}
