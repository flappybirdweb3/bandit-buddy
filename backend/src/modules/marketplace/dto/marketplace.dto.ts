import { IsString, IsNumber, IsPositive, IsDateString, Length, IsNotEmpty } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @Length(42, 42)
  nftContract: string;

  @IsNumber()
  @IsPositive()
  tokenId: number;

  @IsNumber()
  @IsPositive()
  priceFarm: number;

  @IsDateString()
  deadline: string;

  @IsString()
  @IsNotEmpty()
  eip712Sig: string;
}
