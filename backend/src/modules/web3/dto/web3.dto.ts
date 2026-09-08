import { IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ClaimSignatureDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  amountToClaim: number;
}

export class SyncNftDto {
  walletAddress: string;
}
