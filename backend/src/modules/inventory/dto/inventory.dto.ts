import { IsString, IsInt, IsPositive, Min, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

// Crop iconKeys that can be packed/sold (matches seed_configs table in DB + legacy)
export const CROP_KEYS = [
  'turnip', 'carrot', 'corn', 'potato', 'eggplant', 'tomato',
  'pea', 'watermelon', 'strawberry', 'pumpkin', 'grape', 'sunflower', 'rose',
  'wheat', 'pumpkin_demon', 'lucky_peach',
] as const;
export type CropKey = typeof CROP_KEYS[number];

// Standard pack sizes per crop key (crop units consumed → 1 crate)
export const CRATE_PACK_SIZE: Record<CropKey, number> = {
  turnip:        100,
  carrot:        200,
  corn:          100,
  potato:        100,
  eggplant:      100,
  tomato:        100,
  pea:           100,
  watermelon:     50,
  strawberry:     50,
  pumpkin:        50,
  grape:          50,
  sunflower:      20,
  rose:           20,
  wheat:         500,
  pumpkin_demon:  20,
  lucky_peach:    20,
};

export class SellCropsDto {
  @IsString()
  @IsIn(CROP_KEYS.map((k) => `crop_${k}`))
  itemType: string; // e.g. 'crop_wheat'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class PackCrateDto {
  @IsString()
  @IsIn(CROP_KEYS as unknown as string[])
  cropKey: CropKey; // e.g. 'wheat' → consumes 'crop_wheat', creates 'crate_wheat'

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  crateCount: number; // how many crates to pack (each costs CRATE_PACK_SIZE[cropKey] units)
}

export class UnpackCrateDto {
  @IsOptional()
  @IsString()
  crateItemType?: string; // e.g. 'crate_wheat'

  @IsOptional()
  @IsString()
  cropKey?: string; // e.g. 'wheat'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number; // number of crates to unpack

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  crateCount?: number;
}
