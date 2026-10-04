import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsString()
  @IsIn(['ios', 'android'])
  platform!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  pushToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}
