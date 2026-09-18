"use client";

import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";
import type { FeedStatus } from "@/lib/market/types";

const STATUS_STYLE: Record<
  FeedStatus,
  { dot: string; label: string; abbr?: string; text?: string }
> = {
  open: { dot: "bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.9)]", label: "Live" },
  connecting: { dot: "bg-hud-dim animate-pulse", label: "Connecting", abbr: "CONN", text: "text-hud-dim" },
  reconnecting: { dot: "bg-neon-magenta animate-pulse", label: "Reconnecting", abbr: "RECONN", text: "text-neon-magenta" },
  simulated: { dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]", label: "Simulated", abbr: "SIM", text: "text-amber-400" },
  "closed-market": { dot: "bg-hud-dim", label: "Market closed", abbr: "CLOSED", text: "text-hud-dim" },
  closed: { dot: "bg-hud-dim/50", label: "Offline", abbr: "OFFLINE", text: "text-hud-dim" },
};

/**
 * The compact ticker tape along the bottom of the floor.
 *
 * Phase 3 moved the detail — candles, axis, last-close mark — onto the holo
 * panels, so this strip is now just the at-a-glance line: state, price, move.
 * It stays in the DOM rather than the canvas because it must be selectable
 * and readable by a screen reader.
 */
export function TickerHud() {
  const quotes = useMarketStore((s) => s.quotes);
  const status = useMarketStore((s) => s.status);

  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-6">
      <ul
        aria-label="Market ticker"
        className={[
          "pointer-events-auto flex flex-wrap items-stretch justify-center",
          "divide-x divide-white/10 overflow-hidden rounded-xl",
          "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
          "ring-1 ring-white/5 ring-inset",
        ].join(" ")}
      >
        {SYMBOLS.map((spec) => {
          const q = quotes[spec.id];
          const st = STATUS_STYLE[status[spec.id] ?? "connecting"];
          const up = (q?.changePct ?? 0) >= 0;
          const hasPrice = (q?.price ?? 0) > 0;

          return (
            <li key={spec.id} className="flex items-center gap-2.5 px-4 py-2.5">
              {/* The dot is decorative; the state is always in the text layer
                  too, so it never rests on colour alone. */}
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
              <span className="sr-only">
                {st.label}
                {spec.proxyNote ? `, ${spec.proxyNote}` : ""}
              </span>

              <span className="font-display text-[11px] tracking-[0.16em] text-hud">
                {spec.label}
              </span>

              <span className="font-mono text-xs tabular-nums text-hud">
                {hasPrice
                  ? q.price.toLocaleString("en-US", {
                      minimumFractionDigits: spec.precision,
                      maximumFractionDigits: spec.precision,
                    })
                  : "———"}
              </span>

              {hasPrice && (
                <span
                  className={[
                    "font-mono text-[11px] tabular-nums",
                    up ? "text-neon-green" : "text-neon-magenta",
                  ].join(" ")}
                >
                  {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                </span>
              )}

              {st.abbr && (
                <span
                  aria-hidden
                  className={`font-mono text-[9px] tracking-[0.18em] ${st.text ?? "text-hud-dim"}`}
                >
                  {st.abbr}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
