import { ScreenDoc } from "@/components/ui/ScreenDoc";
import { DeskReportCard } from "@/components/ui/DeskReportCard";
import { WriteReportButton } from "@/components/ui/WriteReportButton";
import { hasDatabase } from "@/lib/db/client";
import { recentReports, type ReportRow } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  let reports: ReportRow[] = [];
  let failure: string | null = null;

  if (!hasDatabase()) {
    failure = "No DATABASE_URL is configured, so reports cannot be kept.";
  } else {
    try {
      reports = await recentReports(8);
    } catch (error) {
      failure = `The report log is unreachable: ${String(error).slice(0, 160)}`;
    }
  }

  const [latest, ...earlier] = reports;

  return (
    <ScreenDoc>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.35em] text-neon-magenta uppercase">
              Agent Floor
            </p>
            <h1 className="font-display mt-1 text-3xl tracking-[0.18em] text-hud uppercase">
              Report
            </h1>
          </div>
          <WriteReportButton />
        </header>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-hud-dim">
          The supervisor is the only one who sees all five instruments at once,
          so the report is the part no individual agent can write: what they are
          doing together, and where the agents contradict each other or their own
          measurements. It reads their latest calls and their resolved records
          from the log, and is written only when you ask for it.
        </p>

        {failure ? (
          <p className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 p-6 text-sm text-amber-300">
            {failure}
          </p>
        ) : !latest ? (
          <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-hud-dim">
            No report yet. Let the panels fill, ask a few agents on the
            dashboard so the supervisor has calls to weigh, then press WRITE
            REPORT.
          </p>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
                Latest
              </h2>
              <div className="mt-3">
                <DeskReportCard report={latest} lead />
              </div>
            </section>

            {earlier.length > 0 && (
              <section className="mt-10">
                <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
                  Earlier
                </h2>
                <div className="mt-3 flex flex-col gap-3">
                  {earlier.map((report) => (
                    <DeskReportCard key={report.id} report={report} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
    </ScreenDoc>
  );
}
