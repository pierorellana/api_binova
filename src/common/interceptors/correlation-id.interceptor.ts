import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse();
    const incoming = request.header('X-Correlation-Id');
    const correlationId = incoming?.trim() || `api-${randomUUID()}`;
    request.correlationId = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);
    return next.handle().pipe(tap(() => undefined));
  }
}
