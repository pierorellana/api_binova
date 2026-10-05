export interface ApiMeta {
  traceId: string;
  generatedAt: string;
  nextCursor?: string | null;
}

export interface SuccessOptions {
  message?: string;
  statusCode?: number;
  nextCursor?: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  message: string;
  statusCode: number;
  meta: ApiMeta;
}

export function success<T>(
  data: T,
  traceId: string,
  options: SuccessOptions = {},
): ApiEnvelope<T> {
  return {
    data,
    message: options.message ?? 'Operación exitosa.',
    statusCode: options.statusCode ?? 200,
    meta: {
      traceId,
      generatedAt: new Date().toISOString(),
      ...(options.nextCursor !== undefined
        ? { nextCursor: options.nextCursor }
        : {}),
    },
  };
}
