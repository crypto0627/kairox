import { NextResponse } from "next/server";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import {
  MIN_BARS,
  parseBars,
  parseQuote,
  parseStatus,
} from "@/lib/market/validate";
import { analyse, CapReached } from "@/lib/agent";
import { DEFAULT_FLOOR, isEnabled, personaFor, readSettings } from "@/lib/db/config";
import { hasDatabase } from "@/lib/db/client";
import { recordVerdict } from "@/lib/db/verdicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run one agent over one instrument.
 *
 * The symbol has to be one this app actually displays; see
 * lib/market/validate for why the bars come from the caller.
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

  const quote = parseQuote(body.quote, spec);
  if (!quote) {
    return NextResponse.json({ error: "quote.price required" }, { status: 400 });
  }

  const status = parseStatus(body.status);

  // Configuration is a convenience, not a dependency: if the settings table
  // cannot be read the floor still runs, on the defaults.
  let persona = "";
  let hourlyCap = DEFAULT_FLOOR.hourlyCap;
  if (hasDatabase()) {
    try {
      const [enabled, configured, settings] = await Promise.all([
        isEnabled(spec.id),
        personaFor(spec.id),
        readSettings(),
      ]);
      if (!enabled) {
        return NextResponse.json({ error: "agent disabled", symbolId: spec.id }, { status: 423 });
      }
      persona = configured;
      hourlyCap = settings.floor.hourlyCap;
    } catch {
      /* fall through on defaults */
    }
  }

  let outcome;
  try {
    // A person who clicked "analyse now" is asking for a fresh read, so the
    // coalescing window is skipped for them. The hourly cap is not — that one
    // exists precisely to survive impatience.
    outcome = await analyse(
      { spec, bars, quote, status, persona },
      hourlyCap,
      body.force === true,
    );
  } catch (error) {
    if (error instanceof CapReached) {
      // Not a failure. The floor asked for more thinking than its budget
      // allows, and saying so plainly beats silently spending anyway.
      return NextResponse.json(
        { error: "hourly cap reached", cap: error.cap },
        { status: 429 },
      );
    }
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
