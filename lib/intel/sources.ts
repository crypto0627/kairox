import "server-only";
import type { DailyBar } from "./indicators";

/**
 * Outside data for the intel wall.
 *
 * Every source here is reachable without a key except the news, which reuses
 * the Finnhub key the equity feed already needs. Each one fails on its own:
 * a panel whose source is down says so, and the rest of the wall stays up.
 *
 * Caching is Next's, keyed by URL. These are daily figures — polling them
 * harder would not produce a newer number, only a rate limit.
 */

const DAY_CACHE = 900; // 15 minutes; ETF flows and sentiment publish once a day
const NEWS_CACHE = 300;

export interface EtfFlowDay {
  date: string;
  /** Net creations minus redemptions, in dollars. Negative is an outflow. */
  netInflow: number;
  netAssets: number;
  cumulative: number;
  valueTraded: number;
}

/**
 * US spot Bitcoin ETF flows, from SoSoValue's open API.
 *
 * Chosen over the aggregator everyone screenshots because that one returns
 * 403 to anything that is not a browser, with or without a plausible user
 * agent. That is a policy, not an obstacle to route around; this is a
 * published API and is the right thing to call.
 */
export async function etfFlows(days = 30): Promise<EtfFlowDay[] | null> {
  try {
    const response = await fetch(
      "https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "us-btc-spot" }),
        next: { revalidate: DAY_CACHE },
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      code?: number;
      data?: Array<{
        date: string;
        totalNetInflow: number;
        totalNetAssets: number;
        cumNetInflow: number;
        totalValueTraded: number;
      }>;
    };
    if (body.code !== 0 || !Array.isArray(body.data)) return null;

    // Newest first from the API; the chart reads left to right.
    return body.data
      .slice(0, days)
      .reverse()
      .map((row) => ({
        date: row.date,
        netInflow: Number(row.totalNetInflow) || 0,
        netAssets: Number(row.totalNetAssets) || 0,
        cumulative: Number(row.cumNetInflow) || 0,
        valueTraded: Number(row.totalValueTraded) || 0,
      }));
  } catch {
    return null;
  }
}

export interface FearGreed {
  value: number;
  label: string;
  updatedAt: number;
  history: number[];
}

/** The Crypto Fear & Greed Index. Public, keyless, one figure a day. */
export async function fearGreed(): Promise<FearGreed | null> {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=30", {
      next: { revalidate: DAY_CACHE },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: Array<{ value: string; value_classification: string; timestamp: string }>;
    };
    const rows = body.data;
    if (!rows?.length) return null;

    return {
      value: Number(rows[0].value),
      label: rows[0].value_classification,
      updatedAt: Number(rows[0].timestamp) * 1000,
      history: rows
        .map((row) => Number(row.value))
        .reverse()
        .filter(Number.isFinite),
    };
  } catch {
    return null;
  }
}

/** Daily candles, for indicators this app computes itself. */
export async function dailyBars(symbol = "BTCUSDT", limit = 200): Promise<DailyBar[] | null> {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`,
      { next: { revalidate: NEWS_CACHE } },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<
      [number, string, string, string, string, string, ...unknown[]]
    >;
    return rows.map(([t, o, h, l, c, v]) => ({
      t,
      o: Number(o),
      h: Number(h),
      l: Number(l),
      c: Number(c),
      v: Number(v),
    }));
  } catch {
    return null;
  }
}

export interface Headline {
  id: number;
  headline: string;
  source: string;
  url: string;
  at: number;
}

/** Crypto headlines, through the Finnhub key the equity feed already uses. */
export async function news(limit = 8): Promise<Headline[] | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=crypto&token=${encodeURIComponent(key)}`,
      { next: { revalidate: NEWS_CACHE } },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{
      id: number;
      headline: string;
      source: string;
      url: string;
      datetime: number;
    }>;
    if (!Array.isArray(rows)) return null;
    return rows.slice(0, limit).map((row) => ({
      id: row.id,
      headline: row.headline,
      source: row.source,
      url: row.url,
      at: row.datetime * 1000,
    }));
  } catch {
    return null;
  }
}
