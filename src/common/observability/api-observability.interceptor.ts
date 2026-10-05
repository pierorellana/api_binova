import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuthenticatedRequest } from '../types/authenticated-request';
import { ObservabilityService } from './observability.service';

@Injectable()
export class ApiObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly observability: ObservabilityService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.record(request, response.statusCode, startedAt),
        error: (error: unknown) =>
          this.record(
            request,
            this.errorStatus(error),
            startedAt,
            this.errorCode(error),
          ),
      }),
    );
  }

  private record(
    request: AuthenticatedRequest,
    statusCode: number,
    startedAt: number,
    errorCode?: string,
  ): void {
    this.observability.recordRequest({
      method: request.method,
      route: request.path,
      statusCode,
      latencyMs: Date.now() - startedAt,
      correlationId: request.correlationId || 'unknown',
      ...(errorCode ? { errorCode } : {}),
    });
  }

  private errorStatus(error: unknown): number {
    return typeof error === 'object' && error !== null && 'getStatus' in error
      ? (error as { getStatus(): number }).getStatus()
      : 500;
  }

  private errorCode(error: unknown): string | undefined {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('getResponse' in error)
    ) {
      return undefined;
    }
    const payload = (error as { getResponse(): unknown }).getResponse();
    if (typeof payload !== 'object' || payload === null) return undefined;
    const body = payload as Record<string, unknown>;
    const code = body.code ??
      (typeof body.error === 'object' && body.error !== null
        ? (body.error as Record<string, unknown>).code
        : undefined);
    return typeof code === 'string' ? code : undefined;
  }
}
