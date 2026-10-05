import { success } from './api-response';

describe('success response', () => {
  it('returns the requested fields and preserves correlation metadata', () => {
    const response = success([{ id: 'tx-1' }], 'trace-1', {
      message: 'Movimientos consultados.',
      statusCode: 200,
      nextCursor: 'cursor-2',
    });

    expect(response).toMatchObject({
      data: [{ id: 'tx-1' }],
      message: 'Movimientos consultados.',
      statusCode: 200,
      meta: { traceId: 'trace-1', nextCursor: 'cursor-2' },
    });
    expect(new Date(response.meta.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('uses safe defaults when no options are provided', () => {
    expect(success({ ok: true }, 'trace-2')).toMatchObject({
      data: { ok: true },
      message: 'Operación exitosa.',
      statusCode: 200,
      meta: { traceId: 'trace-2' },
    });
  });
});
