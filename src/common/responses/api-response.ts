export interface ApiMeta {
  traceId: string;
  generatedAt: string;
  nextCursor?: string | null;
}

export function success<T>(
  data: T,
  traceId: string,
  nextCursor?: string | null,
): { data: T; meta: ApiMeta } {
  return {
    data,
    meta: {
      traceId,
      generatedAt: new Date().toISOString(),
      ...(nextCursor !== undefined ? { nextCursor } : {}),
    },
  };
}
