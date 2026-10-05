import { HealthController } from './health.module';

describe('HealthController', () => {
  it('returns the shared success envelope', () => {
    const response = new HealthController().health({
      correlationId: 'health-trace',
    } as never);

    expect(response).toMatchObject({
      data: { status: 'ok' },
      message: 'Operación exitosa.',
      statusCode: 200,
      meta: { traceId: 'health-trace' },
    });
  });
});
