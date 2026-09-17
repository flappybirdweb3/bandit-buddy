import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type ListingStatus = 'active' | 'filled' | 'cancelled';
export type AssetType = 'nft' | 'user_items';

@Entity('marketplace_listings')
export class MarketplaceListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seller_id' })
  sellerId: string;

  // 'nft' = ERC-1155 on-chain; 'user_items' = off-chain (crops, crates, tools, seeds)
  @Column({ type: 'varchar', length: 20, name: 'asset_type', default: 'nft' })
  assetType: AssetType;

  // NFT fields (null for user_items listings)
  @Column({ type: 'varchar', name: 'nft_contract', length: 42, nullable: true })
  nftContract: string | null;

  @Column({ name: 'token_id', type: 'int', nullable: true })
  tokenId: number | null;

  // user_items fields (null for NFT listings)
  @Column({ type: 'varchar', name: 'item_type', length: 100, nullable: true })
  itemType: string | null; // e.g. 'master_key', 'crate_wheat', 'crop_tomato'

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'quantity', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'price_per_unit', nullable: true })
  pricePerUnit: number | null; // $FARM per unit (for user_items)

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'price_farm' })
  priceFarm: number; // total $FARM for the listing

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column({ type: 'int', default: 0 })
  nonce: number;

  @Column({ type: 'varchar', length: 132, name: 'eip712_sig', nullable: true })
  eip712Sig: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: ListingStatus;

  @Column({ name: 'buyer_id', nullable: true })
  buyerId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'filled_at' })
  filledAt: Date | null;

  @Column({ type: 'varchar', length: 66, nullable: true, name: 'tx_hash' })
  txHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User | null;
}
