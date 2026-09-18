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

export interface Scoreboard {
  symbolId: string;
  scored: number;
  hits: number;
  /** null until something has actually been graded. Never guess an accuracy. */
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
      symbol_id                                             as "symbolId",
      count(*)::int                                         as "scored",
      count(*) filter (where outcome = 'hit')::int          as "hits",
      case when count(*) = 0 then null
           else round(count(*) filter (where outcome = 'hit')::numeric
                      / count(*), 3)::float8 end            as "accuracy"
    from agent_verdict
    where scored_at is not null
      and feed_status not in ('simulated', 'closed-market')
    group by symbol_id
    order by symbol_id
  `;
}
