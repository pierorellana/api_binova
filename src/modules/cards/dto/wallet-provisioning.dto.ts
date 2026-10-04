import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class WalletProvisioningDto {
  @ApiProperty({ enum: ['apple_wallet'] })
  @IsString()
  @IsIn(['apple_wallet'])
  wallet!: string;
}
