import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('returns the shared error envelope with correlation metadata', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ correlationId: 'trace-error' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'La sesión expiró.',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: 'La sesión expiró.',
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        details: {},
        meta: expect.objectContaining({ traceId: 'trace-error' }),
      }),
    );
  });
});
