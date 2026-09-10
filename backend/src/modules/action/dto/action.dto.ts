import { IsUUID, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

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
