import { Module } from '@nestjs/common';

import { PushModule } from '../../infrastructure/push/push.module';
import { ObservabilityModule } from '../../common/observability/observability.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, PushModule, ObservabilityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
