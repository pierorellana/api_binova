import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ObservabilityModule } from '../../common/observability/observability.module';
import { PUSH_GATEWAY } from './push.gateway';
import { FirebaseMessagingGateway } from './firebase-messaging.gateway';

@Module({
  imports: [ConfigModule, ObservabilityModule],
  providers: [
    FirebaseMessagingGateway,
    {
      provide: PUSH_GATEWAY,
      useExisting: FirebaseMessagingGateway,
    },
  ],
  exports: [PUSH_GATEWAY],
})
export class PushModule {}
