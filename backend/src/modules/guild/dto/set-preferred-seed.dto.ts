import { IsOptional, IsUUID } from 'class-validator';

export class SetPreferredSeedDto {
  @IsOptional()
  @IsUUID()
  seedId?: string | null;
}
