import type { MarketProvider, ProviderContext } from "./provider";
import type { SymbolSpec } from "./types";

/**
 * Deterministic-ish random walk used when no Finnhub key is configured, and
 * outside US market hours. Keeps the UI alive and honest: every symbol it
 * drives reports status "simulated", which the HUD renders in amber.
 */
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
