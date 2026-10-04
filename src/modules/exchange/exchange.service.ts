import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ObservabilityService } from '../../common/observability/observability.service';
import { ExchangeRate, FX_PROVIDER, FxProvider } from './fx-provider';

interface CachedExchangeRate {
  payload: ExchangeRate;
  fetchedAt: number;
  schemaVersion: number;
}

@Injectable()
export class ExchangeService {
  private readonly cache = new Map<string, CachedExchangeRate>();

  constructor(
    @Inject(FX_PROVIDER) private readonly provider: FxProvider,
    private readonly config: ConfigService,
    private readonly observability?: ObservabilityService,
  ) {}

  async getRate(baseInput: string, quoteInput: string) {
    const base = baseInput?.trim().toUpperCase();
    const quote = quoteInput?.trim().toUpperCase();
    this.validateCurrency(base, 'base');
    this.validateCurrency(quote, 'quote');
    if (base === quote) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'base y quote deben ser monedas distintas.',
      });
    }

    const key = `${base}/${quote}`;
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && now - cached.fetchedAt <= this.seconds('FX_CACHE_TTL_SECONDS', 60) * 1000) {
      return { ...cached.payload, stale: false };
    }

    try {
      const payload = await this.provider.getRate(base, quote);
      this.observability?.recordDependency(
        'fx_provider',
        Date.now() - now,
        true,
      );
      const normalized = { ...payload, base, quote };
      this.cache.set(key, {
        payload: normalized,
        fetchedAt: now,
        schemaVersion: 1,
      });
      return { ...normalized, stale: false };
    } catch {
      this.observability?.recordDependency(
        'fx_provider',
        Date.now() - now,
        false,
      );
      if (
        cached &&
        now - cached.fetchedAt <= this.seconds('FX_STALE_MAX_AGE_SECONDS', 900) * 1000
      ) {
        return { ...cached.payload, stale: true };
      }
      throw new ServiceUnavailableException({
        code: 'FX_UNAVAILABLE',
        message: 'El servicio de tipos de cambio no está disponible.',
      });
    }
  }

  private validateCurrency(value: string, field: string): void {
    if (!/^[A-Z]{3}$/.test(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} debe ser un código de moneda de 3 letras.`,
      });
    }
  }

  private seconds(key: string, fallback: number): number {
    const value = Number(this.config.get<string | number>(key, fallback));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
}
