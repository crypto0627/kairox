import { NextResponse } from "next/server";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import type { Candle, FeedStatus, Quote } from "@/lib/market/types";
import { analyse } from "@/lib/agent";
import { hasDatabase } from "@/lib/db/client";
import { recordVerdict } from "@/lib/db/verdicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Matches the rolling window the panels plot; anything longer is discarded. */
const MAX_BARS = 60;
const MIN_BARS = 8;

const FEED_STATUSES: FeedStatus[] = [
  "connecting",
  "open",
  "reconnecting",
  "closed",
  "closed-market",
  "simulated",
];

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function parseBars(input: unknown): Candle[] | null {
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

/**
 * Run one agent over one instrument.
 *
 * The bars arrive from the browser rather than being re-fetched here. The
 * client already holds the window the panels are drawing, and the alternative
 * is a second copy of the whole feed living server-side to answer a question
 * about what the user is currently looking at. The trade is that the payload
 * is caller-supplied, so it is validated and capped like any other input, and
 * the symbol has to be one this app actually displays.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const spec = SYMBOL_BY_ID.get(String(body.symbolId ?? ""));
  if (!spec) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 403 });
  }

  const bars = parseBars(body.bars);
  if (!bars) {
    return NextResponse.json({ error: "bars malformed" }, { status: 400 });
  }
  if (bars.length < MIN_BARS) {
    return NextResponse.json(
      { error: "not enough bars", need: MIN_BARS, got: bars.length },
      { status: 409 },
    );
  }

  const quoteInput = (body.quote ?? {}) as Partial<Quote>;
  if (!finite(quoteInput.price) || quoteInput.price <= 0) {
    return NextResponse.json({ error: "quote.price required" }, { status: 400 });
  }
  const quote: Quote = {
    symbolId: spec.id,
    price: quoteInput.price,
    prevClose: finite(quoteInput.prevClose) ? quoteInput.prevClose : quoteInput.price,
    change: finite(quoteInput.change) ? quoteInput.change : 0,
    changePct: finite(quoteInput.changePct) ? quoteInput.changePct : 0,
    volume: finite(quoteInput.volume) ? quoteInput.volume : 0,
    updatedAt: Date.now(),
  };

  const statusInput = String(body.status ?? "");
  const status = (FEED_STATUSES as string[]).includes(statusInput)
    ? (statusInput as FeedStatus)
    : "connecting";

  let outcome;
  try {
    outcome = await analyse({ spec, bars, quote, status });
  } catch (error) {
    // The model being down is an ordinary condition here, not a crash: the
    // floor keeps trading and the panel says the agent is offline.
    return NextResponse.json(
      { error: "agent unavailable", detail: String(error).slice(0, 300) },
      { status: 503 },
    );
  }

  const { result, cached } = outcome;

  let id: string | null = null;
  // A coalesced answer is the same judgment served twice; logging it again
  // would double-count it in the accuracy numbers.
  if (hasDatabase() && !cached) {
    try {
      id = await recordVerdict({
        ...result,
        symbolId: spec.id,
        price: quote.price,
        bars: bars.length,
        feedStatus: status,
      });
    } catch (error) {
      // A verdict the user can see but that was not logged is still useful;
      // losing the whole call because the log is down is not.
      console.error("verdict not recorded:", error);
    }
  }

  return NextResponse.json({ id, symbolId: spec.id, cached, ...result, recordedAt: Date.now() });
}
