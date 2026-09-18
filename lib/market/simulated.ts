import type { MarketProvider, ProviderContext } from "./provider";
import type { Candle, SymbolSpec } from "./types";

/**
 * Deterministic-ish random walk used when no Finnhub key is configured, and
 * outside US market hours. Keeps the UI alive and honest: every symbol it
 * drives reports status "simulated", which the HUD renders in amber.
 */
const HISTORY_BARS = 40;
const BUCKET_MS = 60_000;

export function createSimulatedProvider(
  specs: SymbolSpec[],
  ctx: ProviderContext,
  { intervalMs = 1000 }: { intervalMs?: number } = {},
): MarketProvider {
  const last = new Map(specs.map((s) => [s.id, s.seedPrice] as const));
  let timer: number | undefined;
  const ids = specs.map((s) => s.id);

  return {
    id: "simulated",

    /**
     * A back-history for the back-walk. Every symbol this provider drives
     * already reports status "simulated" and the panels say so in amber, so
     * inventing its past is consistent rather than deceptive — it is the same
     * made-up series, just extended backwards from the seed price.
     */
    history(): Map<string, Candle[]> {
      const out = new Map<string, Candle[]>();
      const latestBucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;

      for (const spec of specs) {
        // Walk backwards from the seed so the newest bar meets the live feed.
        const closes: number[] = [];
        let p = spec.seedPrice;
        for (let i = 0; i < HISTORY_BARS; i++) {
          closes.push(p);
          p = Math.max(0.01, p - p * 0.0015 * (Math.random() * 2 - 1));
        }
        closes.reverse();

        out.set(
          spec.id,
          closes.map((close, i) => {
            const open = i === 0 ? close : closes[i - 1];
            const wick = Math.max(close * 0.0004, Math.abs(close - open) * 0.7);
            return {
              // Oldest bar first; the newest is the minute that just closed.
              t: latestBucket - (HISTORY_BARS - i) * BUCKET_MS,
              o: open,
              c: close,
              h: Math.max(open, close) + Math.random() * wick,
              l: Math.min(open, close) - Math.random() * wick,
              v: Math.random() * 1000,
            } satisfies Candle;
          }),
        );
      }
      return out;
    },

    connect() {
      ctx.onStatus(ids, "simulated");
      for (const spec of specs) {
        ctx.onTick({
          symbolId: spec.id,
          price: spec.seedPrice,
          volume: 0,
          ts: Date.now(),
        });
      }

      timer = window.setInterval(() => {
        for (const spec of specs) {
          const prev = last.get(spec.id) ?? spec.seedPrice;
          // ~0.04% per step, mean-reverting toward the seed
          const drift = (spec.seedPrice - prev) * 0.002;
          const shock = prev * 0.0004 * (Math.random() * 2 - 1);
          const next = Math.max(0.01, prev + drift + shock);
          last.set(spec.id, next);
          ctx.onTick({
            symbolId: spec.id,
            price: next,
            volume: Math.random() * 1000,
            ts: Date.now(),
          });
        }
      }, intervalMs);
    },
    dispose() {
      window.clearInterval(timer);
    },
  };
}
