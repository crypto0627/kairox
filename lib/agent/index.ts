import "server-only";
import type { AgentProvider, VerdictRequest, VerdictResult } from "./types";
import { createOllamaProvider } from "./ollama";

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
  const choice = process.env.AGENT_PROVIDER ?? "ollama";
  switch (choice) {
    case "ollama":
      return createOllamaProvider();
    case "claude":
      throw new Error(
        "AGENT_PROVIDER=claude is not wired up yet. Use ollama, or ask for the " +
          "Claude provider to be added.",
      );
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
): Promise<AnalyseOutcome> {
  const key = request.spec.id;
  const existing = inFlight.get(key);
  if (existing && Date.now() - existing.at < COOLDOWN_MS) {
    // A coalesced answer costs nothing, so it is not counted against the cap.
    return { result: await existing.work, cached: true };
  }

  if (!withinCap(hourlyCap)) throw new CapReached(hourlyCap);
  callTimes.push(Date.now());

  const provider = agentProvider();
  const started = Date.now();
  const work = runQueued(() => provider.analyse(request)).then((verdict) => ({
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
