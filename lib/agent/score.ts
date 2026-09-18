import "server-only";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import type { SymbolSpec } from "@/lib/market/types";
import { applyScore, pendingVerdicts, type PendingVerdict } from "@/lib/db/verdicts";

/** How far ahead a verdict is judged. The prompt asks for a 15–30 minute
 *  read, so it is graded at the middle of the window it claimed. */
export const HORIZON_MIN = 20;

/**
 * Dead band, as a percentage of the decision price.
 *
 * Below this the market has not answered the question. A directional call
 * that lands inside the band is recorded as unresolved rather than wrong —
 * punishing an agent for a quiet twenty minutes would make the accuracy
 * number a measure of volatility rather than of judgment.
 */
export const BAND_PCT = 0.15;

export type Outcome = "hit" | "miss" | "flat";

/** Grade one call. Pure, so the rule can be read in one place. */
export function grade(
  stance: PendingVerdict["stance"],
  before: number,
  after: number,
  bandPct = BAND_PCT,
): Outcome {
  const movePct = ((after - before) / before) * 100;
  const moved = Math.abs(movePct) >= bandPct;

  if (stance === "flat") return moved ? "miss" : "hit";
  if (!moved) return "flat";
  if (stance === "long") return movePct > 0 ? "hit" : "miss";
  return movePct < 0 ? "hit" : "miss";
}

async function binancePrice(spec: SymbolSpec): Promise<number | null> {
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${spec.remote.toUpperCase()}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { price?: string };
  const price = Number(json.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function finnhubPrice(spec: SymbolSpec): Promise<number | null> {
  const key = process.env.FINNHUB_API_KEY;
  // No key means no way to price the equity. The row stays pending rather
  // than being graded against a number we invented.
  if (!key) return null;
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(spec.remote)}` +
      `&token=${encodeURIComponent(key)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { c?: number };
  return Number.isFinite(json.c) && (json.c as number) > 0 ? (json.c as number) : null;
}

/** Current price for one instrument, straight from its provider's REST side. */
async function currentPrice(spec: SymbolSpec): Promise<number | null> {
  try {
    return spec.provider === "binance" ? await binancePrice(spec) : await finnhubPrice(spec);
  } catch {
    return null;
  }
}

export interface ScoreRun {
  examined: number;
  graded: number;
  skipped: number;
}

/**
 * Grade everything past its horizon.
 *
 * Prices come from the providers' own REST endpoints rather than from the
 * browser's store: a judgment should still get marked whether or not anyone
 * happened to have the tab open twenty minutes later.
 */
export async function scorePending(): Promise<ScoreRun> {
  const pending = await pendingVerdicts(HORIZON_MIN);
  if (!pending.length) return { examined: 0, graded: 0, skipped: 0 };

  // One quote per symbol per run, not one per row.
  const prices = new Map<string, number | null>();
  for (const symbolId of new Set(pending.map((p) => p.symbolId))) {
    const spec = SYMBOL_BY_ID.get(symbolId);
    prices.set(symbolId, spec ? await currentPrice(spec) : null);
  }

  let graded = 0;
  let skipped = 0;
  for (const verdict of pending) {
    const after = prices.get(verdict.symbolId);
    if (!after) {
      skipped++;
      continue;
    }
    await applyScore({
      id: verdict.id,
      priceAfter: after,
      horizonMin: HORIZON_MIN,
      bandPct: BAND_PCT,
      outcome: grade(verdict.stance, verdict.price, after),
    });
    graded++;
  }

  return { examined: pending.length, graded, skipped };
}
