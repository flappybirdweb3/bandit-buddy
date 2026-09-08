import { IsUUID, IsNotEmpty } from 'class-validator';

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
