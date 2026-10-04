import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExchangeRate, FxProvider } from './fx-provider';

@Injectable()
export class HttpFxProvider implements FxProvider {
  constructor(private readonly config: ConfigService) {}

  async getRate(base: string, quote: string): Promise<ExchangeRate> {
    const configuredUrl = this.config.get<string>('FX_PROVIDER_BASE_URL', '').trim();
    if (!configuredUrl) throw new Error('FX provider URL is not configured');

    const url = new URL(configuredUrl);
    url.searchParams.set('base', base);
    url.searchParams.set('quote', quote);
    const controller = new AbortController();
    const timeoutMs = this.numberConfig('FX_PROVIDER_TIMEOUT_MS', 2000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...(this.config.get<string>('FX_PROVIDER_API_KEY', '').trim()
            ? {
                Authorization: `Bearer ${this.config
                  .get<string>('FX_PROVIDER_API_KEY', '')
                  .trim()}`,
              }
            : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`FX provider returned HTTP ${response.status}`);
      const body: unknown = JSON.parse(await response.text());
      return this.normalize(body, base, quote);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(body: unknown, base: string, quote: string): ExchangeRate {
    const root = this.record(body);
    if (!root) throw new Error('FX provider returned an invalid payload');
    const nestedData = this.record(root.data);
    const data = nestedData ?? root;
    const rates = this.record(data.rates);
    const rawRate = data.rate ?? data.result ?? rates?.[quote];
    const numericRate = Number(rawRate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new Error('FX provider returned an invalid rate');
    }

    const responseBase = typeof data.base === 'string' ? data.base.toUpperCase() : base;
    const responseQuote = typeof data.quote === 'string' ? data.quote.toUpperCase() : quote;
    if (responseBase !== base || responseQuote !== quote) {
      throw new Error('FX provider returned an unexpected currency pair');
    }

    return {
      base,
      quote,
      rate: numericRate.toString(),
      asOf: this.dateValue(data.asOf ?? data.timestamp ?? data.date),
      source: this.config.get<string>('FX_PROVIDER_NAME', 'configured'),
    };
  }

  private record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null;
  }

  private dateValue(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return new Date().toISOString();
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string | number>(key, fallback));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
