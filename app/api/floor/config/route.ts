import { NextResponse } from "next/server";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import { hasDatabase } from "@/lib/db/client";
import {
  DEFAULT_FLOOR,
  readSettings,
  writeSettings,
  type AgentConfig,
  type FloorSettings,
} from "@/lib/db/config";
import { agentProvider, callsThisHour } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONA_LIMIT = 400;

/** Which model is actually answering, so the page never has to guess. */
function activeProvider(): { id: string; model: string } {
  try {
    const provider = agentProvider();
    return { id: provider.id, model: provider.model };
  } catch (error) {
    return { id: "unconfigured", model: String(error).slice(0, 80) };
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Settings the floor runs on, plus how much of the hour's budget is gone.
 *
 * Without a database the floor still runs on defaults — the config is a
 * convenience, not a dependency — so this answers rather than erroring.
 */
export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({
      floor: DEFAULT_FLOOR,
      agents: [...SYMBOL_BY_ID.values()].map((spec) => ({
        symbolId: spec.id,
        persona: "",
        enabled: true,
      })),
      callsThisHour: callsThisHour(),
      provider: activeProvider(),
      persisted: false,
    });
  }

  try {
    const settings = await readSettings();
    return NextResponse.json({
      ...settings,
      callsThisHour: callsThisHour(),
      provider: activeProvider(),
      persisted: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "settings unavailable", detail: String(error).slice(0, 200) },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "no database configured" }, { status: 503 });
  }

  let body: Partial<FloorSettings>;
  try {
    body = (await request.json()) as Partial<FloorSettings>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const agents: AgentConfig[] = [];
  for (const raw of Array.isArray(body.agents) ? body.agents : []) {
    // Same rule as every other route here: the symbol has to be one this app
    // actually displays.
    if (!SYMBOL_BY_ID.has(String(raw?.symbolId))) continue;
    agents.push({
      symbolId: String(raw.symbolId),
      persona: String(raw.persona ?? "").slice(0, PERSONA_LIMIT),
      enabled: raw.enabled !== false,
    });
  }

  try {
    const saved = await writeSettings({
      floor: {
        cycleMinutes: clamp(body.floor?.cycleMinutes, 1, 240, DEFAULT_FLOOR.cycleMinutes),
        hourlyCap: clamp(body.floor?.hourlyCap, 0, 2000, DEFAULT_FLOOR.hourlyCap),
      },
      agents,
    });
    return NextResponse.json({
      ...saved,
      callsThisHour: callsThisHour(),
      provider: activeProvider(),
      persisted: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "could not save", detail: String(error).slice(0, 200) },
      { status: 500 },
    );
  }
}
