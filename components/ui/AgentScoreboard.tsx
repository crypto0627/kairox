import type { Scoreboard } from "@/lib/db/verdicts";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";

/**
 * Accuracy per agent.
 *
 * Five headline numbers, so these are stat tiles rather than a chart — there
 * is nothing here a plot would show that the number does not. The denominator
 * is stated beside every figure: an agent that is right once out of one is
 * not a better agent than one that is right nine times out of twelve, and a
 * bare percentage would say otherwise.
 */
export function AgentScoreboard({ rows }: { rows: Scoreboard[] }) {
  const byId = new Map(rows.map((r) => [r.symbolId, r]));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {[...SYMBOL_BY_ID.values()].map((spec) => {
        const row = byId.get(spec.id);
        const resolved = (row?.hits ?? 0) + (row?.misses ?? 0);
        const pct = row?.accuracy != null ? Math.round(row.accuracy * 100) : null;

        return (
          <div
            key={spec.id}
            className="rounded-xl border border-white/10 bg-white/[0.05] p-4 ring-1 ring-white/5 ring-inset"
          >
            <p className="font-display text-xs tracking-[0.18em] text-hud-dim">
              {spec.label}
            </p>
            <p
              className={[
                "mt-2 font-mono text-3xl tabular-nums",
                pct == null
                  ? "text-hud-dim"
                  : pct >= 50
                    ? "text-neon-green"
                    : "text-neon-magenta",
              ].join(" ")}
            >
              {pct == null ? "—" : `${pct}%`}
            </p>
            <p className="mt-1 font-mono text-[10px] text-hud-dim">
              {resolved === 0
                ? "nothing resolved yet"
                : `${row?.hits ?? 0} of ${resolved} resolved`}
            </p>
            {(row?.unresolved ?? 0) > 0 && (
              <p className="mt-0.5 font-mono text-[10px] text-hud-dim/70">
                {row?.unresolved} unresolved
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
