import {
  IsString, IsNumber, IsPositive, IsDateString, Length, IsNotEmpty,
  IsOptional, Min, Max, IsIn, IsInt, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── NFT listing (existing EIP-712 flow) ────────────────────────────────────
export class CreateListingDto {
  @IsString()
  @Length(42, 42)
  nftContract: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  tokenId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1)
  amount?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  priceFarm: number;

  @IsDateString()
  deadline: string;

  @IsString()
  @IsNotEmpty()
  eip712Sig: string;
}

// ── user_items listing (Issues #60 + #61) ──────────────────────────────────
// Items eligible for off-chain marketplace listing
const LISTABLE_ITEM_TYPES = [
  // viral tools
  'magnifying_glass', 'master_key',
  // crop crates (after packing)
  'crate_turnip', 'crate_carrot', 'crate_corn', 'crate_potato', 'crate_eggplant',
  'crate_tomato', 'crate_pea', 'crate_watermelon', 'crate_strawberry',
  'crate_pumpkin', 'crate_grape', 'crate_sunflower', 'crate_rose',
  'crate_wheat', 'crate_pumpkin_demon', 'crate_lucky_peach',
  // rare/seasonal seeds
  'seed_rose', 'seed_sunflower', 'seed_pumpkin_demon', 'seed_lucky_peach',
  // soul shards (from dog gacha / smash)
  'soul_shard',
] as const;

export class CreateItemListingDto {
  @IsString()
  @IsIn(LISTABLE_ITEM_TYPES)
  itemType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  priceFarm: number; // total $FARM for the listing

  @IsDateString()
  deadline: string;

  // EIP-712 sig optional for now (required once BanditMarket.sol supports off-chain items)
  @IsOptional()
  @IsString()
  eip712Sig?: string;
}

export class GetListingsQueryDto {
  @IsOptional()
  @IsIn(['nft', 'user_items'])
  assetType?: 'nft' | 'user_items';

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['price', 'createdAt', 'deadline'])
  sortBy?: 'price' | 'createdAt' | 'deadline';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
