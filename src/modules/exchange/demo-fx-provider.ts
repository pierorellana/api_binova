import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExchangeRate, FxProvider } from './fx-provider';

@Injectable()
export class DemoFxProvider implements FxProvider {
  constructor(private readonly config: ConfigService) {}

  async getRate(base: string, quote: string): Promise<ExchangeRate> {
    const pair = `${base}/${quote}`;
    const knownRates: Record<string, string> = {
      'USD/EUR': '0.92',
      'EUR/USD': '1.08',
      'USD/GBP': '0.79',
      'GBP/USD': '1.27',
    };
    const rate = knownRates[pair] ?? this.deterministicRate(base, quote);

    return {
      base,
      quote,
      rate,
      asOf: new Date().toISOString(),
      source: this.config.get<string>('FX_PROVIDER_NAME', 'demo'),
    };
  }

  private deterministicRate(base: string, quote: string): string {
    const baseScore = [...base].reduce((total, character) => total + character.charCodeAt(0), 0);
    const quoteScore = [...quote].reduce((total, character) => total + character.charCodeAt(0), 0);
    const value = 0.5 + ((baseScore * 31 + quoteScore * 17) % 150) / 100;
    return value.toFixed(4);
  }
}
