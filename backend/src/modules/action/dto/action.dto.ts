import { IsUUID, IsNotEmpty, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class PlantDto {
  @IsUUID()
  @IsNotEmpty()
  plotId: string;

  @IsUUID()
  @IsNotEmpty()
  seedId: string;
}

export class HarvestDto {
  @IsUUID()
  @IsNotEmpty()
  plotId: string;
}

export class StealDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;

  @IsUUID()
  @IsNotEmpty()
  plotId: string;

  @IsOptional()
  @IsBoolean()
  useMasterKey?: boolean;
}

export class RevealThiefDto {
  @IsUUID()
  @IsNotEmpty()
  stealLogId: string;
}

export class RepairDto {
  @IsIn(['fence', 'barn'])
  target: 'fence' | 'barn';

  /** How much durability to restore (10-100, increments of 10) */
  @IsNotEmpty()
  amount: number;
}

export class PlotIdDto {
  @IsUUID()
  @IsNotEmpty()
  plotId: string;
}

export class FertilizeDto {
  @IsUUID()
  @IsNotEmpty()
  plotId: string;

  @IsOptional()
  @IsIn(['auto', 'normal', 'super', 'advanced'])
  tier?: 'auto' | 'normal' | 'super' | 'advanced';
}

export class ThrowAttackDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;

  @IsUUID()
  @IsNotEmpty()
  plotId: string;

  @IsIn(['bugs', 'weeds'])
  type: 'bugs' | 'weeds';
}
