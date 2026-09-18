"use client";

import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";
import type { FeedStatus } from "@/lib/market/types";

const STATUS_STYLE: Record<FeedStatus, { dot: string; label: string }> = {
  open: { dot: "bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.9)]", label: "LIVE" },
  connecting: { dot: "bg-hud-dim animate-pulse", label: "CONNECTING" },
  reconnecting: { dot: "bg-neon-magenta animate-pulse", label: "RECONNECTING" },
  simulated: { dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]", label: "SIMULATED" },
  "closed-market": { dot: "bg-hud-dim", label: "MARKET CLOSED" },
  closed: { dot: "bg-hud-dim/50", label: "OFFLINE" },
};

/**
 * DOM overlay for the five instruments. This is the Phase 2 verification
 * surface — Phase 3 moves the same data onto the holo panels as ECharts
 * candlesticks, and this strip becomes the compact ticker tape.
 */
export function TickerHud() {
  const quotes = useMarketStore((s) => s.quotes);
  const status = useMarketStore((s) => s.status);

  return (
    <div className="absolute inset-x-0 top-0 flex justify-center px-6 pt-6 pl-72">
      <div className="flex w-full max-w-5xl gap-3">
        {SYMBOLS.map((spec) => {
          const q = quotes[spec.id];
          const st = STATUS_STYLE[status[spec.id] ?? "connecting"];
          const up = (q?.changePct ?? 0) >= 0;
          const hasPrice = (q?.price ?? 0) > 0;

          return (
            <div
              key={spec.id}
              className={[
                "pointer-events-auto flex-1 rounded-xl border border-white/10",
                "bg-white/[0.04] px-4 py-3 backdrop-blur-xl",
                "ring-1 ring-inset ring-white/5",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-sm tracking-[0.18em] text-hud">
                  {spec.label}
                </span>
                <span
                  className={[
                    "font-mono text-xs tabular-nums",
                    up ? "text-neon-green" : "text-neon-magenta",
                  ].join(" ")}
                >
                  {hasPrice
                    ? `${up ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%`
                    : "—"}
                </span>
              </div>

              <p className="mt-1 font-mono text-lg tabular-nums text-hud">
                {hasPrice
                  ? q.price.toLocaleString("en-US", {
                      minimumFractionDigits: spec.precision,
                      maximumFractionDigits: spec.precision,
                    })
                  : "———"}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className="font-mono text-[9px] tracking-[0.18em] text-hud-dim">
                  {st.label}
                </span>
                {spec.proxyNote && (
                  <span className="ml-auto font-mono text-[9px] text-hud-dim/70">
                    {spec.proxyNote}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
