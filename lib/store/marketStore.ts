import { create } from "zustand";
import { SYMBOLS } from "@/lib/market/symbols";
import type { Candle, FeedStatus, Quote } from "@/lib/market/types";
import type { Snapshot } from "@/lib/market/throttle";

/** Rolling in-memory window. Nothing is persisted, by design. */
const MAX_CANDLES = 120;

interface MarketState {
  quotes: Record<string, Quote>;
  candles: Record<string, Candle[]>;
  status: Record<string, FeedStatus>;
  lastFlush: number;
  applyBatch: (batch: Map<string, Snapshot>) => void;
  seedCandles: (seed: Map<string, Candle[]>) => void;
  setStatus: (symbolIds: string[], status: FeedStatus) => void;
}

const initialQuotes: Record<string, Quote> = Object.fromEntries(
  SYMBOLS.map((s) => [
    s.id,
    {
      symbolId: s.id,
      price: 0,
      prevClose: 0,
      change: 0,
      changePct: 0,
      volume: 0,
      updatedAt: 0,
    } satisfies Quote,
  ]),
);

const initialStatus: Record<string, FeedStatus> = Object.fromEntries(
  SYMBOLS.map((s) => [s.id, "connecting" as FeedStatus]),
);

export const useMarketStore = create<MarketState>((set) => ({
  quotes: initialQuotes,
  candles: Object.fromEntries(SYMBOLS.map((s) => [s.id, [] as Candle[]])),
  status: initialStatus,
  lastFlush: 0,

  applyBatch: (batch) =>
    set((state) => {
      const quotes = { ...state.quotes };
      const candles = { ...state.candles };

      for (const [symbolId, snap] of batch) {
        const series = candles[symbolId] ?? [];
        const lastIdx = series.length - 1;
        let next: Candle[];

        if (lastIdx >= 0 && series[lastIdx].t === snap.candle.t) {
          next = series.slice();
          next[lastIdx] = snap.candle;
        } else {
          next = [...series, snap.candle];
          if (next.length > MAX_CANDLES) next = next.slice(-MAX_CANDLES);
        }
        candles[symbolId] = next;

        // The oldest bar the store holds is the reference for the change
        // figure — set once and then sticky, so the number does not jump when
        // history lands or when old bars scroll out of the window.
        const prevClose =
          state.quotes[symbolId]?.prevClose || next[0]?.o || snap.price;

        quotes[symbolId] = {
          symbolId,
          price: snap.price,
          prevClose,
          change: snap.price - prevClose,
          changePct: prevClose ? ((snap.price - prevClose) / prevClose) * 100 : 0,
          volume: snap.volume,
          updatedAt: snap.ts,
        };
      }

      return { quotes, candles, lastFlush: Date.now() };
    }),

  /**
   * Prime symbols with closed historical bars. Merges rather than replaces:
   * a provider's history request can resolve after its socket has already
   * pushed a bar, so only bars older than what is held get prepended.
   */
  seedCandles: (seed) =>
    set((state) => {
      const candles = { ...state.candles };
      const quotes = { ...state.quotes };
      let changed = false;

      for (const [symbolId, bars] of seed) {
        if (!bars.length) continue;
        const existing = candles[symbolId] ?? [];
        const oldestHeld = existing[0]?.t ?? Number.POSITIVE_INFINITY;
        const older = bars.filter((b) => b.t < oldestHeld);
        if (!older.length) continue;

        const merged = [...older, ...existing].slice(-MAX_CANDLES);
        candles[symbolId] = merged;
        changed = true;

        // Re-anchor the change figure to the now-oldest bar.
        const quote = quotes[symbolId];
        const prevClose = merged[0].o;
        if (quote && prevClose) {
          quotes[symbolId] = {
            ...quote,
            prevClose,
            change: quote.price ? quote.price - prevClose : 0,
            changePct: quote.price ? ((quote.price - prevClose) / prevClose) * 100 : 0,
          };
        }
      }

      return changed ? { candles, quotes } : state;
    }),

  setStatus: (symbolIds, status) =>
    set((state) => {
      const next = { ...state.status };
      for (const id of symbolIds) next[id] = status;
      return { status: next };
    }),
}));
