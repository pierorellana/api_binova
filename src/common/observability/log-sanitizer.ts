const ALLOWED_FIELDS = new Set([
  'event',
  'method',
  'route',
  'statusCode',
  'latencyMs',
  'correlationId',
  'errorCode',
  'code',
  'dependency',
  'succeeded',
  'message',
  'notificationId',
  'sentCount',
  'invalidCount',
  'failedCount',
]);

export function sanitizeApiLog(
  fields: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safe[key] = value;
    }
  }
  return safe;
}
