export interface ExchangeRate {
  base: string;
  quote: string;
  rate: string;
  asOf: string;
  source: string;
}

export interface FxProvider {
  getRate(base: string, quote: string): Promise<ExchangeRate>;
}

export const FX_PROVIDER = Symbol('FX_PROVIDER');
