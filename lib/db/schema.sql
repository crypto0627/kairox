-- KAIROX agent accountability log.
--
-- One row per judgment an agent makes, written when it speaks and graded
-- later once the market has had time to answer.
--
-- Idempotent: safe to run on every boot. There is one table, so a migration
-- framework would cost more than it carries.

create table if not exists agent_verdict (
  id           bigserial     primary key,
  symbol_id    text          not null,
  decided_at   timestamptz   not null default now(),

  -- What the agent was looking at. feed_status is not bookkeeping: a call
  -- made on a simulated feed cannot be scored against one made on a live
  -- one, and mixing them would quietly inflate the accuracy number. The
  -- rest of this app never fakes a feed silently; neither does this table.
  price        numeric(20,8) not null,
  bars         integer       not null,
  feed_status  text          not null,

  -- What it said.
  stance       text          not null check (stance in ('long','short','flat')),
  confidence   real          not null check (confidence >= 0 and confidence <= 1),
  headline     text          not null,
  reasoning    text          not null,
  risk         text          not null default '',

  -- Who said it, and what it cost to say.
  provider     text          not null,
  model        text          not null,
  latency_ms   integer       not null,

  -- Grading, filled in by the scorer once the horizon has elapsed.
  -- band_pct is stored per row rather than read from config at scoring
  -- time, so retuning the rule later cannot silently rewrite history.
  scored_at    timestamptz,
  horizon_min  integer,
  band_pct     numeric(6,4),
  price_after  numeric(20,8),
  outcome      text          check (outcome in ('hit','miss','flat'))
);

create index if not exists agent_verdict_symbol_time
  on agent_verdict (symbol_id, decided_at desc);

-- Drives the scorer: find what is old enough to grade, cheaply.
create index if not exists agent_verdict_pending
  on agent_verdict (decided_at)
  where scored_at is null;
