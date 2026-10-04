import { success } from './api-response';

describe('success response', () => {
  it('returns the stable envelope and pagination metadata', () => {
    const response = success([{ id: 'tx-1' }], 'trace-1', 'cursor-2');

    expect(response.data).toEqual([{ id: 'tx-1' }]);
    expect(response.meta.traceId).toBe('trace-1');
    expect(response.meta.nextCursor).toBe('cursor-2');
    expect(new Date(response.meta.generatedAt).toString()).not.toBe('Invalid Date');
  });
});
