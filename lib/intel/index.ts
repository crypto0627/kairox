import "server-only";
import { macd, rsi, volume, type Macd, type Rsi, type VolumeRead } from "./indicators";
import {
  dailyBars,
  etfFlows,
  fearGreed,
  news,
  type EtfFlowDay,
  type FearGreed,
  type Headline,
} from "./sources";

export interface IntelSnapshot {
  etf: EtfFlowDay[] | null;
  sentiment: FearGreed | null;
  macd: Macd | null;
  rsi: Rsi | null;
  volume: VolumeRead | null;
  /** Latest daily close, so the indicator panel can state what it is reading. */
  close: number | null;
  headlines: Headline[] | null;
  at: number;
}

/**
 * Everything the intel wall shows, gathered in parallel.
 *
 * Nothing here throws. Each source returns null on failure and the wall says
 * which panel is dark, because a blank panel and a panel showing stale
 * numbers are the same thing to someone reading it across a room.
 */
export async function intelSnapshot(): Promise<IntelSnapshot> {
  const [etf, sentiment, bars, headlines] = await Promise.all([
    etfFlows(),
    fearGreed(),
    dailyBars(),
    news(),
  ]);

  const closes = bars?.map((bar) => bar.c) ?? [];

  return {
    etf,
    sentiment,
    macd: closes.length ? macd(closes) : null,
    rsi: closes.length ? rsi(closes) : null,
    volume: bars ? volume(bars) : null,
    close: closes.length ? closes[closes.length - 1] : null,
    headlines,
    at: Date.now(),
  };
}
