export type ProviderId = "binance" | "finnhub" | "simulated";

export type FeedStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "closed-market"
  | "simulated";

export interface SymbolSpec {
  /** Stable key used everywhere in the app. */
  id: string;
  /** What the user sees on the panel. */
  label: string;
  /** e.g. "via SPY" — shown small, so a proxy is never hidden. */
  proxyNote?: string;
  provider: ProviderId;
  /** The provider's own symbol string. */
  remote: string;
  currency: string;
  /** Decimal places for display. */
  precision: number;
  /** Only open during US cash hours. */
  marketHours: boolean;
  /** Seed price for the simulated feed. */
  seedPrice: number;
}

export interface Tick {
  symbolId: string;
  price: number;
  /** Trade size, when the provider reports one. */
  volume?: number;
  ts: number;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  symbolId: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  updatedAt: number;
}
