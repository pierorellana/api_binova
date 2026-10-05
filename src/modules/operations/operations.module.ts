import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
