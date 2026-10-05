import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExchangeRate, FxProvider } from './fx-provider';

@Injectable()
export class DemoFxProvider implements FxProvider {
  constructor(private readonly config: ConfigService) {}

  async getRate(base: string, quote: string): Promise<ExchangeRate> {
    const rate = this.tableRate(base, quote) ?? this.deterministicRate(base, quote);

    return {
      base,
      quote,
      rate,
      asOf: new Date().toISOString(),
      source: this.config.get<string>('FX_PROVIDER_NAME', 'demo'),
    };
  }

  /** Units per 1 USD, as shown in the BInova prototype (Conversor). */
  private static readonly perUsd: Record<string, number> = {
    USD: 1,
    EUR: 0.8603,
    GBP: 0.7462,
    COP: 4012.5,
    PEN: 3.721,
    MXN: 18.452,
  };

  private tableRate(base: string, quote: string): string | null {
    const from = DemoFxProvider.perUsd[base];
    const to = DemoFxProvider.perUsd[quote];
    if (from === undefined || to === undefined) return null;
    return Number((to / from).toFixed(6)).toString();
  }

  private deterministicRate(base: string, quote: string): string {
    const baseScore = [...base].reduce((total, character) => total + character.charCodeAt(0), 0);
    const quoteScore = [...quote].reduce((total, character) => total + character.charCodeAt(0), 0);
    const value = 0.5 + ((baseScore * 31 + quoteScore * 17) % 150) / 100;
    return value.toFixed(4);
  }
}
