import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guild, GuildMember])],
  exports: [TypeOrmModule],
})
export class GuildModule {}
