import type { VerdictRow } from "@/lib/db/verdicts";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";

const STANCE = {
  long: { label: "LONG", tint: "text-neon-green", glyph: "▲" },
  short: { label: "SHORT", tint: "text-neon-magenta", glyph: "▼" },
  flat: { label: "FLAT", tint: "text-amber-400", glyph: "■" },
} as const;

/** Outcome carries a word as well as a colour — never colour alone. */
const OUTCOME = {
  hit: { label: "HIT", tint: "text-neon-green" },
  miss: { label: "MISS", tint: "text-neon-magenta" },
  flat: { label: "UNRESOLVED", tint: "text-hud-dim" },
} as const;

function when(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function VerdictLog({ rows }: { rows: VerdictRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.05] p-6 text-sm text-hud-dim">
        Nothing logged yet. The floor reports a few seconds after the panels fill.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const stance = STANCE[row.stance];
        const outcome = row.outcome ? OUTCOME[row.outcome] : null;
        const spec = SYMBOL_BY_ID.get(row.symbolId);
        const simulated = row.feedStatus === "simulated";

        return (
          <li
            key={row.id}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 ring-1 ring-white/5 ring-inset"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] text-hud-dim">{when(row.decidedAt)}</span>
              <span className="font-display text-sm tracking-[0.14em] text-hud">
                {spec?.label ?? row.symbolId}
              </span>
              <span className={`font-mono text-xs ${stance.tint}`}>
                {stance.glyph} {stance.label}
              </span>
              <span className="font-mono text-[11px] text-hud-dim">
                conf {row.confidence.toFixed(2)}
              </span>

              {/* Provenance sits beside the call, not in a footnote. A verdict
                  made on the simulated walk is never scored, and the log says
                  which ones those are. */}
              {simulated && (
                <span className="rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-amber-400">
                  SIMULATED · NOT SCORED
                </span>
              )}

              <span className="ml-auto font-mono text-[10px] text-hud-dim/70">
                {row.model} · {(row.latencyMs / 1000).toFixed(1)}s
              </span>
              <span
                className={`font-mono text-[10px] tracking-[0.14em] ${
                  outcome ? outcome.tint : "text-hud-dim/60"
                }`}
              >
                {outcome ? outcome.label : simulated ? "—" : "PENDING"}
              </span>
            </div>

            <p className="mt-1.5 text-sm text-hud">{row.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-hud-dim">{row.reasoning}</p>
            {row.risk && (
              <p className="mt-1 font-mono text-[11px] text-hud-dim/80">
                risk: {row.risk}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
