import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { MoneyLimitDto } from './money-limit.dto';

export class UpdateCardLimitsDto {
  @ApiPropertyOptional({ type: MoneyLimitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyLimitDto)
  dailyPurchaseLimit?: MoneyLimitDto;

  @ApiPropertyOptional({ type: MoneyLimitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyLimitDto)
  dailyWithdrawalLimit?: MoneyLimitDto;
}
