import { IsNumber, IsInt, IsPositive, Min, IsBoolean, IsString, IsUUID, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ClaimSignatureDto {
  @Type(() => Number)
  @IsNumber()
  // GOLD is an integer currency. A fractional amount survives parseUnits() as a non-round
  // wei value and matches nothing the UI can express, so reject it at the edge instead of
  // deducting GOLD for a claim the player never intended.
  @IsInt()
  @IsPositive()
  @Min(1)
  amountToClaim: number;
}

export class RefundClaimDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nonce: number;
}

export class SyncNftDto {
  walletAddress: string;
}

export class TokenizeDogDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  count: number; // 1 or 3
}

export class SetDogGuardingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  tokenId: number;

  @IsBoolean()
  isGuarding: boolean;
}

export class SetDogGuardingByIdDto {
  @IsString()
  @IsUUID()
  dogId: string;

  @IsBoolean()
  isGuarding: boolean;
}

export class DepositVerifyDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'txHash must be a valid 32-byte hex hash' })
  txHash: string;
}
