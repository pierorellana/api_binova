import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DevicesController } from './devices.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController, DevicesController],
  providers: [ProfileService],
})
export class ProfileModule {}
