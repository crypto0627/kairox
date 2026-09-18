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

        // First bar of the session is the reference for the day's change.
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

  setStatus: (symbolIds, status) =>
    set((state) => {
      const next = { ...state.status };
      for (const id of symbolIds) next[id] = status;
      return { status: next };
    }),
}));
