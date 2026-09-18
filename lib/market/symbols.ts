import type { SymbolSpec } from "./types";

/**
 * Finnhub's free tier streams US equities and ETFs but not index symbols,
 * so S&P 500 and PHLX ride on liquid ETF proxies. The label stays honest
 * via `proxyNote` rather than pretending to be the index.
 */
export const SYMBOLS: SymbolSpec[] = [
  {
    id: "BTC",
    label: "BTC",
    provider: "binance",
    remote: "btcusdt",
    currency: "USD",
    precision: 2,
    marketHours: false,
    seedPrice: 43875,
  },
  {
    id: "GOLD",
    label: "GOLD",
    proxyNote: "via GLD",
    provider: "finnhub",
    remote: "GLD",
    currency: "USD",
    precision: 2,
    marketHours: true,
    seedPrice: 204.8,
  },
  {
    id: "QQQ",
    label: "QQQ",
    provider: "finnhub",
    remote: "QQQ",
    currency: "USD",
    precision: 2,
    marketHours: true,
    seedPrice: 405.15,
  },
  {
    id: "SPX",
    label: "S&P 500",
    proxyNote: "via SPY",
    provider: "finnhub",
    remote: "SPY",
    currency: "USD",
    precision: 2,
    marketHours: true,
    seedPrice: 491.03,
  },
  {
    id: "PHLX",
    label: "PHLX SOX",
    proxyNote: "via SOXX",
    provider: "finnhub",
    remote: "SOXX",
    currency: "USD",
    precision: 2,
    marketHours: true,
    seedPrice: 389.24,
  },
];

export const SYMBOL_BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));
export const SYMBOL_BY_REMOTE = new Map(
  SYMBOLS.map((s) => [s.remote.toUpperCase(), s]),
);

/** Rough US cash session check (09:30–16:00 ET, Mon–Fri). */
export function isUsMarketOpen(now = new Date()): boolean {
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = et.getHours() * 60 + et.getMinutes();
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
