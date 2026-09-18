import "server-only";
import { db } from "./client";
import type { Stance, VerdictResult } from "@/lib/agent/types";
import type { FeedStatus } from "@/lib/market/types";

export interface VerdictRow {
  id: string;
  symbolId: string;
  decidedAt: string;
  price: number;
  bars: number;
  feedStatus: FeedStatus;
  stance: Stance;
  confidence: number;
  headline: string;
  reasoning: string;
  risk: string;
  provider: string;
  model: string;
  latencyMs: number;
  outcome: "hit" | "miss" | "flat" | null;
}

export interface RecordInput extends VerdictResult {
  symbolId: string;
  price: number;
  bars: number;
  feedStatus: FeedStatus;
}

/** Write one judgment to the log. Returns the row id. */
export async function recordVerdict(input: RecordInput): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into agent_verdict
      (symbol_id, price, bars, feed_status, stance, confidence,
       headline, reasoning, risk, provider, model, latency_ms)
    values
      (${input.symbolId}, ${input.price}, ${input.bars}, ${input.feedStatus},
       ${input.stance}, ${input.confidence}, ${input.headline}, ${input.reasoning},
       ${input.risk}, ${input.provider}, ${input.model}, ${input.latencyMs})
    returning id::text
  `;
  return row.id;
}

/** Most recent judgment per symbol — what the floor is currently thinking. */
export async function latestVerdicts(): Promise<VerdictRow[]> {
  return db<VerdictRow[]>`
    select distinct on (symbol_id)
      id::text                   as "id",
      symbol_id                  as "symbolId",
      decided_at                 as "decidedAt",
      price::float8              as "price",
      bars                       as "bars",
      feed_status                as "feedStatus",
      stance, confidence, headline, reasoning, risk, provider, model,
      latency_ms                 as "latencyMs",
      outcome
    from agent_verdict
    order by symbol_id, decided_at desc
  `;
}

/** The log, newest first. Drives the History page. */
export async function verdictHistory(limit = 100): Promise<VerdictRow[]> {
  return db<VerdictRow[]>`
    select
      id::text                   as "id",
      symbol_id                  as "symbolId",
      decided_at                 as "decidedAt",
      price::float8              as "price",
      bars                       as "bars",
      feed_status                as "feedStatus",
      stance, confidence, headline, reasoning, risk, provider, model,
      latency_ms                 as "latencyMs",
      outcome
    from agent_verdict
    order by decided_at desc
    limit ${limit}
  `;
}

/** A verdict old enough to grade, with what it needs to be graded. */
export interface PendingVerdict {
  id: string;
  symbolId: string;
  decidedAt: string;
  price: number;
  stance: Stance;
}

/**
 * Judgments past their horizon that nobody has graded yet.
 *
 * Simulated rows are skipped, not graded and excluded later: scoring a call
 * against a random walk would write a number into the log that means nothing,
 * and a row that carries a meaningless outcome invites someone to average it.
 */
export async function pendingVerdicts(
  horizonMinutes: number,
  limit = 40,
): Promise<PendingVerdict[]> {
  return db<PendingVerdict[]>`
    select
      id::text      as "id",
      symbol_id     as "symbolId",
      decided_at    as "decidedAt",
      price::float8 as "price",
      stance
    from agent_verdict
    where scored_at is null
      and feed_status not in ('simulated', 'closed-market')
      and decided_at < now() - make_interval(mins => ${horizonMinutes})
    order by decided_at
    limit ${limit}
  `;
}

export interface ScoreInput {
  id: string;
  priceAfter: number;
  horizonMin: number;
  bandPct: number;
  outcome: "hit" | "miss" | "flat";
}

/** Write a grade. band_pct is stored per row so retuning the rule later
 *  cannot silently rewrite history. */
export async function applyScore(input: ScoreInput): Promise<void> {
  await db`
    update agent_verdict set
      scored_at   = now(),
      price_after = ${input.priceAfter},
      horizon_min = ${input.horizonMin},
      band_pct    = ${input.bandPct},
      outcome     = ${input.outcome}
    where id = ${input.id}::bigint
      and scored_at is null
  `;
}

export interface Scoreboard {
  symbolId: string;
  scored: number;
  hits: number;
  misses: number;
  /** Calls where the market did not move enough to resolve the direction. */
  unresolved: number;
  /** hits / (hits + misses); null until something has actually resolved.
   *  Never guess an accuracy. */
  accuracy: number | null;
}

/**
 * Accuracy, counting only judgments made on a live feed.
 *
 * A call made against the simulated walk says nothing about the agent, and
 * folding those rows in would quietly inflate the number — which is exactly
 * the kind of silent fakery the rest of this app refuses.
 */
export async function scoreboard(): Promise<Scoreboard[]> {
  return db<Scoreboard[]>`
    select
      symbol_id                                        as "symbolId",
      count(*)::int                                    as "scored",
      count(*) filter (where outcome = 'hit')::int     as "hits",
      count(*) filter (where outcome = 'miss')::int    as "misses",
      count(*) filter (where outcome = 'flat')::int    as "unresolved",
      -- Unresolved calls are excluded from the denominator. A directional
      -- call the market never answered is not a wrong call, and counting it
      -- as one would punish an agent for a quiet twenty minutes.
      case when count(*) filter (where outcome in ('hit','miss')) = 0 then null
           else round(
             count(*) filter (where outcome = 'hit')::numeric
             / count(*) filter (where outcome in ('hit','miss')), 3)::float8
      end                                              as "accuracy"
    from agent_verdict
    where scored_at is not null
      and feed_status not in ('simulated', 'closed-market')
    group by symbol_id
    order by symbol_id
  `;
}
