import { NextResponse } from "next/server";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import { MIN_BARS, parseBars, parseQuote, parseStatus } from "@/lib/market/validate";
import { CapReached, writeReport } from "@/lib/agent";
import type { ReportInstrument } from "@/lib/agent/report";
import { hasDatabase } from "@/lib/db/client";
import { DEFAULT_FLOOR, readSettings } from "@/lib/db/config";
import { latestVerdicts, scoreboard } from "@/lib/db/verdicts";
import { recordReport } from "@/lib/db/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Write the desk report.
 *
 * On demand only, like everything else the model does. The floor snapshot
 * comes from the browser; the agents' own calls and their resolved records
 * come from the log, because those are facts about the past that the client
 * has no business asserting.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const snapshot = Array.isArray(body.instruments) ? body.instruments : [];
  const instruments: ReportInstrument[] = [];

  for (const raw of snapshot) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const spec = SYMBOL_BY_ID.get(String(entry.symbolId ?? ""));
    if (!spec) continue;
    const bars = parseBars(entry.bars);
    if (!bars || bars.length < MIN_BARS) continue;
    const quote = parseQuote(entry.quote, spec);
    if (!quote) continue;
    instruments.push({ spec, bars, quote, status: parseStatus(entry.status) });
  }

  if (instruments.length < 2) {
    // A "cross-instrument read" of one instrument is just that agent's call
    // again, and writing it would spend a model call to say nothing new.
    return NextResponse.json(
      { error: "need at least two instruments with data", got: instruments.length },
      { status: 409 },
    );
  }

  let hourlyCap = DEFAULT_FLOOR.hourlyCap;
  if (hasDatabase()) {
    try {
      const [verdicts, scores, settings] = await Promise.all([
        latestVerdicts(),
        scoreboard(),
        readSettings(),
      ]);
      hourlyCap = settings.floor.hourlyCap;

      const byVerdict = new Map(verdicts.map((v) => [v.symbolId, v]));
      const byScore = new Map(scores.map((s) => [s.symbolId, s]));
      for (const item of instruments) {
        const verdict = byVerdict.get(item.spec.id);
        if (verdict) {
          item.verdict = {
            stance: verdict.stance,
            confidence: verdict.confidence,
            headline: verdict.headline,
            decidedAt: verdict.decidedAt,
          };
        }
        const score = byScore.get(item.spec.id);
        item.accuracy = score
          ? { hits: score.hits, resolved: score.hits + score.misses }
          : null;
      }
    } catch {
      // The report is still worth writing from the live snapshot alone; it
      // just cannot say what the agents called or how well they have done.
    }
  }

  let result;
  try {
    result = await writeReport(instruments, hourlyCap);
  } catch (error) {
    if (error instanceof CapReached) {
      return NextResponse.json(
        { error: "hourly cap reached", cap: error.cap },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "supervisor unavailable", detail: String(error).slice(0, 300) },
      { status: 503 },
    );
  }

  const simulated = instruments.filter((i) => i.status === "simulated").length;

  let id: string | null = null;
  if (hasDatabase()) {
    try {
      id = await recordReport({
        ...result,
        instruments: instruments.length,
        simulated,
      });
    } catch (error) {
      console.error("report not recorded:", error);
    }
  }

  return NextResponse.json({
    id,
    ...result,
    instruments: instruments.length,
    simulated,
    createdAt: new Date().toISOString(),
  });
}
