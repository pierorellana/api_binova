import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateVirtualCardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fundingAccountId?: string;
}
