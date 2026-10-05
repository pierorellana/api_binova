import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

import { AuthenticatedRequest } from '../types/authenticated-request';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException
      ? exception.getResponse()
      : undefined;
    const details =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const message =
      typeof details.message === 'string'
        ? details.message
        : status >= 500
          ? 'Ocurrió un error inesperado.'
          : 'La solicitud no es válida.';
    const code =
      typeof details.code === 'string'
        ? details.code
        : this.codeForStatus(status);
    const traceId = request.correlationId || 'unknown';

    response.status(status).json({
      data: null,
      message,
      statusCode: status,
      code,
      details:
        typeof details.details === 'object' && details.details !== null
          ? details.details
          : {},
      meta: {
        traceId,
        generatedAt: new Date().toISOString(),
      },
    });
  }

  private codeForStatus(status: number): string {
    if (status === 400) return 'VALIDATION_ERROR';
    if (status === 401) return 'SESSION_EXPIRED';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'IDEMPOTENCY_CONFLICT';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'SERVICE_UNAVAILABLE';
    return 'VALIDATION_ERROR';
  }
}
