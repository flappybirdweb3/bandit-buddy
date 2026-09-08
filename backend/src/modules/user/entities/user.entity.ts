import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { FarmPlot } from '../../farm/entities/farm-plot.entity';
import { StealLog } from '../../farm/entities/steal-log.entity';
import { NftGuardDog } from '../../farm/entities/nft-guard-dog.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true, name: 'telegram_id' })
  telegramId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 42, nullable: true, name: 'wallet_address' })
  walletAddress: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, name: 'gold_balance' })
  goldBalance: number;

  @Column({ type: 'int', default: 100 })
  energy: number;

  @Column({ type: 'int', default: 50, name: 'trust_score' })
  trustScore: number;

  @Column({ type: 'int', default: 0 })
  nonce: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => FarmPlot, (plot) => plot.user)
  farmPlots: FarmPlot[];

  @OneToMany(() => StealLog, (log) => log.thief)
  theftsDone: StealLog[];

  @OneToMany(() => StealLog, (log) => log.victim)
  theftsReceived: StealLog[];

  @OneToMany(() => NftGuardDog, (dog) => dog.owner)
  guardDogs: NftGuardDog[];
}
