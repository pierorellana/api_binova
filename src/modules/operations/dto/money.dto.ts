import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class MoneyDto {
  @ApiProperty({ example: '25.00' })
  @IsString()
  @Matches(/^\d{1,16}(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}
