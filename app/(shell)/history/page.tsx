import { ScreenDoc } from "@/components/ui/ScreenDoc";
import { AgentScoreboard } from "@/components/ui/AgentScoreboard";
import { ScoreRefresh } from "@/components/ui/ScoreRefresh";
import { VerdictLog } from "@/components/ui/VerdictLog";
import { hasDatabase } from "@/lib/db/client";
import { scoreboard, verdictHistory, type Scoreboard, type VerdictRow } from "@/lib/db/verdicts";
import { BAND_PCT, HORIZON_MIN } from "@/lib/agent/score";

// The log changes on its own schedule, so nothing here may be cached.
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let rows: VerdictRow[] = [];
  let scores: Scoreboard[] = [];
  let failure: string | null = null;

  if (!hasDatabase()) {
    failure = "No DATABASE_URL is configured, so nothing is being logged.";
  } else {
    try {
      [rows, scores] = await Promise.all([verdictHistory(80), scoreboard()]);
    } catch (error) {
      // The floor keeps trading when the log is down; the page says so rather
      // than showing an empty table that reads as "no calls made".
      failure = `The log is unreachable: ${String(error).slice(0, 160)}`;
    }
  }

  return (
    <ScreenDoc>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.35em] text-neon-magenta uppercase">
              Agent Floor
            </p>
            <h1 className="font-display mt-1 text-3xl tracking-[0.18em] text-hud uppercase">
              History
            </h1>
          </div>
          <ScoreRefresh />
        </header>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-hud-dim">
          Every call each agent has made, and how it turned out. A verdict is
          graded {HORIZON_MIN} minutes after it was given, against a{" "}
          {BAND_PCT}% dead band: inside that the market has not answered, and a
          directional call is recorded as unresolved rather than wrong. Calls
          made on a simulated feed are never scored — they would say nothing
          about the agent, and averaging them in would only flatter it.
        </p>

        {failure ? (
          <p className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 p-6 text-sm text-amber-300">
            {failure}
          </p>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
                Accuracy
              </h2>
              <div className="mt-3">
                <AgentScoreboard rows={scores} />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
                Log · newest first
              </h2>
              <div className="mt-3">
                <VerdictLog rows={rows} />
              </div>
            </section>
          </>
        )}
    </ScreenDoc>
  );
}
