import "server-only";
import type { AgentProvider, VerdictRequest, VerdictResult } from "./types";
import { VERDICT_SCHEMA, normaliseVerdict } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  REPORT_SCHEMA,
  REPORT_SYSTEM,
  buildReportPrompt,
  normaliseReport,
  type DeskReport,
  type ReportInstrument,
} from "./report";
import { createOllamaProvider } from "./ollama";
import { createClaudeProvider } from "./claude";

/**
 * Provider selection, mirroring lib/market/provider.ts.
 *
 * The market layer already proved the shape: one interface, several
 * transports, and swapping a source touches one file. The agent layer runs a
 * local model in development and Claude in production behind the same
 * contract, so the two stay comparable — same prompt, same schema, same
 * normalisation.
 */
function create(): AgentProvider {
  // Defaults to the local model on purpose. Forgetting to set this should
  // never be the thing that starts a bill.
  const choice = process.env.AGENT_PROVIDER ?? "ollama";
  switch (choice) {
    case "ollama":
      return createOllamaProvider();
    case "claude":
      return createClaudeProvider();
    default:
      throw new Error(`Unknown AGENT_PROVIDER: ${choice}`);
  }
}

let cached: AgentProvider | null = null;

export function agentProvider(): AgentProvider {
  cached ??= create();
  return cached;
}

/**
 * One inference at a time.
 *
 * An 8B model takes ~9 s a call on this machine and holds ~5 GB resident.
 * Five route handlers firing at once would either thrash a 16 GB laptop or
 * queue inside Ollama anyway, so the queue lives here where it can be
 * reasoned about. Remote providers do not need it, but it costs nothing.
 */
let chain: Promise<unknown> = Promise.resolve();

export function runQueued<T>(job: () => Promise<T>): Promise<T> {
  const result = chain.then(job, job);
  // Keep the chain alive even when a job rejects.
  chain = result.catch(() => undefined);
  return result;
}

/**
 * Per-symbol coalescing window.
 *
 * Not an optimisation — a cost control. A StrictMode double-mount ran the
 * whole floor twice and put nine rows in the log for five instruments; two
 * browser tabs would do the same, and a refresh loop worse. The client guards
 * itself too, but the client is not the thing that can be trusted with the
 * bill, so the rule lives here.
 */
const COOLDOWN_MS = 60_000;

interface Entry {
  at: number;
  work: Promise<VerdictResult>;
}

const inFlight = new Map<string, Entry>();

/**
 * Rolling-hour call counter — the brake.
 *
 * Deliberately in memory rather than a query over the log. The cap exists to
 * stop a runaway loop, and a limiter that stops working when the database is
 * unreachable fails in exactly the situation it is there for. A restart
 * clears it, which is the right trade: the ceiling is per-process and cannot
 * be lost, but it also cannot be inherited by a process that never ran.
 */
const callTimes: number[] = [];

export class CapReached extends Error {
  constructor(readonly cap: number) {
    super(`hourly cap of ${cap} model calls reached`);
    this.name = "CapReached";
  }
}

function withinCap(cap: number): boolean {
  const cutoff = Date.now() - 3_600_000;
  while (callTimes.length && callTimes[0] < cutoff) callTimes.shift();
  return callTimes.length < cap;
}

/** Calls made in the last rolling hour, for the Profile page. */
export function callsThisHour(): number {
  const cutoff = Date.now() - 3_600_000;
  while (callTimes.length && callTimes[0] < cutoff) callTimes.shift();
  return callTimes.length;
}

export interface AnalyseOutcome {
  result: VerdictResult;
  /** True when this answer was served from the cooldown window rather than
   *  generated. Callers use it to avoid logging the same judgment twice. */
  cached: boolean;
}

export async function analyse(
  request: VerdictRequest,
  hourlyCap = Number.POSITIVE_INFINITY,
  force = false,
): Promise<AnalyseOutcome> {
  const key = request.spec.id;
  const existing = inFlight.get(key);
  if (!force && existing && Date.now() - existing.at < COOLDOWN_MS) {
    // A coalesced answer costs nothing, so it is not counted against the cap.
    return { result: await existing.work, cached: true };
  }

  if (!withinCap(hourlyCap)) throw new CapReached(hourlyCap);
  callTimes.push(Date.now());

  const provider = agentProvider();
  const started = Date.now();
  const work = runQueued(async () => {
    const raw = await provider.complete({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(request),
      schema: VERDICT_SCHEMA,
    });
    // Normalised whichever provider answered. A schema-constrained response
    // should not need it, but the thing that has to hold is the CHECK
    // constraint on the column, not our confidence in the model.
    return normaliseVerdict(raw);
  }).then((verdict) => ({
    ...verdict,
    provider: provider.id,
    model: provider.model,
    latencyMs: Date.now() - started,
  }));

  inFlight.set(key, { at: started, work });
  try {
    return { result: await work, cached: false };
  } catch (error) {
    // A failed call must not poison the window for a minute.
    inFlight.delete(key);
    throw error;
  }
}

export interface ReportResult extends DeskReport {
  provider: string;
  model: string;
  latencyMs: number;
}

/**
 * The supervisor's cross-instrument read.
 *
 * Not coalesced: a report is written when someone asks for one, and two
 * requests a minute apart are asking about two different floors. It is
 * counted against the hourly cap like any other call, and it queues behind
 * the agents like any other call — on a local model it is the most expensive
 * single thing the app does, because the prompt carries all five instruments.
 */
export async function writeReport(
  instruments: ReportInstrument[],
  hourlyCap = Number.POSITIVE_INFINITY,
): Promise<ReportResult> {
  if (!withinCap(hourlyCap)) throw new CapReached(hourlyCap);
  callTimes.push(Date.now());

  const provider = agentProvider();
  const started = Date.now();

  const raw = await runQueued(() =>
    provider.complete({
      system: REPORT_SYSTEM,
      user: buildReportPrompt(instruments),
      schema: REPORT_SCHEMA,
      maxTokens: 900,
    }),
  );

  return {
    ...normaliseReport(raw),
    provider: provider.id,
    model: provider.model,
    latencyMs: Date.now() - started,
  };
}
