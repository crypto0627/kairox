import type { ReportRow } from "@/lib/db/reports";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeskReportCard({ report, lead }: { report: ReportRow; lead?: boolean }) {
  return (
    <article
      className={[
        "rounded-xl border border-white/10 ring-1 ring-white/5 ring-inset",
        lead ? "bg-white/[0.06] p-6" : "bg-white/[0.04] p-5",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] text-hud-dim">{when(report.createdAt)}</span>
        <span className="font-mono text-[10px] text-hud-dim/70">
          {report.instruments} instruments
          {report.simulated > 0 && ` · ${report.simulated} simulated`}
        </span>
        <span className="ml-auto font-mono text-[10px] text-hud-dim/70">
          {report.model} · {(report.latencyMs / 1000).toFixed(1)}s
        </span>
      </div>

      <h3
        className={[
          "mt-2 leading-snug text-hud",
          lead ? "font-display text-xl tracking-wide" : "text-base",
        ].join(" ")}
      >
        {report.headline}
      </h3>

      <p className="mt-3 text-sm leading-relaxed text-hud-dim">{report.summary}</p>

      {report.agreement && (
        <div className="mt-4">
          <p className="font-mono text-[10px] tracking-[0.25em] text-hud-dim/70 uppercase">
            Where they differ
          </p>
          <p className="mt-1 text-sm leading-relaxed text-hud-dim">{report.agreement}</p>
        </div>
      )}

      {report.watch.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] tracking-[0.25em] text-hud-dim/70 uppercase">
            Watch
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {report.watch.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-hud-dim">
                <span className="text-neon-cyan">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.caveat && (
        <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[13px] leading-relaxed text-amber-300/90">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Caveat</span>
          <br />
          {report.caveat}
        </p>
      )}
    </article>
  );
}
