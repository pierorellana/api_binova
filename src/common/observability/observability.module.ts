import { Module } from '@nestjs/common';

import { ApiObservabilityInterceptor } from './api-observability.interceptor';
import { ObservabilityService } from './observability.service';

@Module({
  providers: [ObservabilityService, ApiObservabilityInterceptor],
  exports: [ObservabilityService, ApiObservabilityInterceptor],
})
export class ObservabilityModule {}
