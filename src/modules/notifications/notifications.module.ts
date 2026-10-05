import { Module } from '@nestjs/common';

import { PushModule } from '../../infrastructure/push/push.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
