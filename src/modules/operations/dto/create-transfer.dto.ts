import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { MoneyDto } from './money.dto';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty()
  @IsUUID()
  beneficiaryId!: string;

  @ApiProperty({ type: MoneyDto })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;
}
