import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('claim_intents')
export class ClaimIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  nonce: number;

  @Column({ name: 'wallet_address', length: 42 })
  walletAddress: string;

  @Column({ name: 'amount_gold', type: 'decimal', precision: 20, scale: 2 })
  amountGold: string;

  @Column({ name: 'amount_wei', length: 80 })
  amountWei: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
