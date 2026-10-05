import { sanitizeApiLog } from './log-sanitizer';

describe('sanitizeApiLog', () => {
  it('keeps operational fields and removes sensitive fields', () => {
    expect(
      sanitizeApiLog({
        event: 'api_request',
        method: 'POST',
        route: '/v1/auth/login',
        statusCode: 401,
        latencyMs: 12,
        correlationId: 'trace-1',
        code: 'AUTH_INVALID_CREDENTIALS',
        password: 'must-not-appear',
        authorization: 'Bearer secret',
      }),
    ).toEqual({
      event: 'api_request',
      method: 'POST',
      route: '/v1/auth/login',
      statusCode: 401,
      latencyMs: 12,
      correlationId: 'trace-1',
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });
});
