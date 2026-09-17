import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('processed_onchain_txs')
export class ProcessedOnchainTx {
  @PrimaryColumn({ name: 'tx_hash', type: 'varchar', length: 66 })
  txHash: string;

  @PrimaryColumn({ name: 'log_index', type: 'int', default: 0 })
  logIndex: number;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
