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

export class CreateTopupDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  operatorId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  lineNumber!: string;

  @ApiProperty()
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ type: MoneyDto })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;
}
