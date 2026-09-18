import type { Candle, FeedStatus, Quote, SymbolSpec } from "./types";

/** Matches the rolling window the panels plot; anything longer is discarded. */
export const MAX_BARS = 60;
export const MIN_BARS = 8;

const FEED_STATUSES: FeedStatus[] = [
  "connecting",
  "open",
  "reconnecting",
  "closed",
  "closed-market",
  "simulated",
];

export function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Bars arrive from the browser rather than being re-fetched server-side: the
 * client already holds the window the panels are drawing, and the alternative
 * is a second copy of the whole feed living here to answer a question about
 * what the user is currently looking at. The trade is that the payload is
 * caller-supplied, so it is validated and capped like any other input.
 */
export function parseBars(input: unknown): Candle[] | null {
  if (!Array.isArray(input)) return null;
  const bars: Candle[] = [];
  for (const raw of input.slice(-MAX_BARS)) {
    const b = raw as Partial<Candle>;
    if (![b.t, b.o, b.h, b.l, b.c].every(finite)) return null;
    bars.push({
      t: b.t as number,
      o: b.o as number,
      h: b.h as number,
      l: b.l as number,
      c: b.c as number,
      v: finite(b.v) ? b.v : 0,
    });
  }
  return bars;
}

export function parseQuote(input: unknown, spec: SymbolSpec): Quote | null {
  const q = (input ?? {}) as Partial<Quote>;
  if (!finite(q.price) || q.price <= 0) return null;
  return {
    symbolId: spec.id,
    price: q.price,
    prevClose: finite(q.prevClose) ? q.prevClose : q.price,
    change: finite(q.change) ? q.change : 0,
    changePct: finite(q.changePct) ? q.changePct : 0,
    volume: finite(q.volume) ? q.volume : 0,
    updatedAt: Date.now(),
  };
}

export function parseStatus(input: unknown): FeedStatus {
  const value = String(input ?? "");
  return (FEED_STATUSES as string[]).includes(value) ? (value as FeedStatus) : "connecting";
}
