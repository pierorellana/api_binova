import { Injectable, Logger } from '@nestjs/common';

import { sanitizeApiLog } from './log-sanitizer';

interface RequestObservation {
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  correlationId: string;
  errorCode?: string;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('BInovaObservability');

  recordRequest(observation: RequestObservation): void {
    this.write(observation.errorCode ? 'warn' : 'log', {
      event: 'api_request',
      ...observation,
    });
  }

  recordDependency(
    dependency: string,
    latencyMs: number,
    succeeded: boolean,
    code?: string,
  ): void {
    this.write(succeeded ? 'log' : 'warn', {
      event: 'dependency_call',
      dependency,
      latencyMs,
      succeeded,
      ...(code ? { code } : {}),
    });
  }

  private write(level: 'log' | 'warn', event: Record<string, unknown>): void {
    this.logger[level](JSON.stringify(sanitizeApiLog(event)));
  }
}
