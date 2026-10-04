import { ExchangeService } from './exchange.service';
import { ExchangeRate, FxProvider } from './fx-provider';

describe('ExchangeService', () => {
  const config = (values: Record<string, string | number>) => ({
    get: <T>(key: string, fallback?: T) =>
      (values[key] === undefined ? fallback : values[key]) as T,
  });

  const rate: ExchangeRate = {
    base: 'USD',
    quote: 'EUR',
    rate: '0.92',
    asOf: '2026-10-04T00:00:00.000Z',
    source: 'fake',
  };

  it('uses the fresh cache without calling the provider again', async () => {
    const provider: FxProvider = {
      getRate: jest.fn().mockResolvedValue(rate),
    };
    const service = new ExchangeService(
      provider,
      config({ FX_CACHE_TTL_SECONDS: 60, FX_STALE_MAX_AGE_SECONDS: 900 }) as never,
    );

    await service.getRate('usd', 'eur');
    const second = await service.getRate('USD', 'EUR');

    expect(second.stale).toBe(false);
    expect(provider.getRate).toHaveBeenCalledTimes(1);
  });

  it('returns stale cache when the provider fails inside the stale window', async () => {
    const provider: FxProvider = {
      getRate: jest
        .fn()
        .mockResolvedValueOnce(rate)
        .mockRejectedValueOnce(new Error('timeout')),
    };
    const service = new ExchangeService(
      provider,
      config({ FX_CACHE_TTL_SECONDS: 0, FX_STALE_MAX_AGE_SECONDS: 900 }) as never,
    );

    const now = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_001);
    try {
      await service.getRate('USD', 'EUR');
      const stale = await service.getRate('USD', 'EUR');

      expect(stale.stale).toBe(true);
      expect(stale.rate).toBe('0.92');
    } finally {
      now.mockRestore();
    }
  });

  it('returns FX_UNAVAILABLE when there is no usable cache', async () => {
    const provider: FxProvider = {
      getRate: jest.fn().mockRejectedValue(new Error('unavailable')),
    };
    const service = new ExchangeService(
      provider,
      config({ FX_CACHE_TTL_SECONDS: 60, FX_STALE_MAX_AGE_SECONDS: 900 }) as never,
    );

    await expect(service.getRate('USD', 'EUR')).rejects.toMatchObject({
      response: { code: 'FX_UNAVAILABLE' },
      status: 503,
    } as any);
  });
});
