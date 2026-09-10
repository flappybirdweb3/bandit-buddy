import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type ListingStatus = 'active' | 'filled' | 'cancelled';

@Entity('marketplace_listings')
export class MarketplaceListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @Column({ name: 'nft_contract', length: 42 })
  nftContract: string;

  @Column({ name: 'token_id', type: 'int' })
  tokenId: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'price_farm' })
  priceFarm: number;

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column({ type: 'int', default: 0 })
  nonce: number;

  @Column({ length: 132, name: 'eip712_sig' })
  eip712Sig: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: ListingStatus;

  @Column({ name: 'buyer_id', nullable: true })
  buyerId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'filled_at' })
  filledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User | null;
}
