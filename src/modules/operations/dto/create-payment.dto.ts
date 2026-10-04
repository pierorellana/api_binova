import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { MoneyDto } from './money.dto';

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  providerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  accountReference!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  debtReference!: string;

  @ApiProperty()
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ type: MoneyDto })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;
}
