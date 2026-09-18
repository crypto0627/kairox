"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { agentOf, useAgentStore } from "@/lib/store/agentStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";

const STANCE = {
  long: { label: "LONG", tint: "text-neon-green", bar: "bg-neon-green", glyph: "▲" },
  short: { label: "SHORT", tint: "text-neon-magenta", bar: "bg-neon-magenta", glyph: "▼" },
  flat: { label: "FLAT", tint: "text-amber-400", bar: "bg-amber-400", glyph: "■" },
} as const;

/**
 * The full read on one agent, in the DOM.
 *
 * The holo panel over each console can only ever be a badge — it is a couple of
 * hundred screen pixels of texture seen at an angle, and a paragraph of
 * reasoning is not readable there at any size that fits the room. The same
 * argument the sidebar already makes: text belongs above the canvas, where it
 * stays crisp, selectable and reachable by a screen reader.
 */
export function AgentInspector() {
  const selected = useAgentStore((s) => s.selected);
  const agents = useAgentStore((s) => s.agents);
  const select = useAgentStore((s) => s.select);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const pathname = usePathname();

  // Docked right, which is exactly where Report and History put their text.
  // The floor is something you inspect from the floor; over a document it is
  // just a panel eating the right third of the page.
  if (!selected || pathname !== "/") return null;

  const spec = SYMBOL_BY_ID.get(selected);
  const agent = agentOf(agents, selected);
  const stance = STANCE[agent.stance];
  const spoken = agent.phase === "spoken";

  async function analyseNow() {
    if (!selected) return;
    setAsking(true);
    setNote(null);
    const { setPhase, setVerdict, setError } = useAgentStore.getState();
    const market = useMarketStore.getState();
    const bars = market.candles[selected] ?? [];
    const quote = market.quotes[selected];

    if (bars.length < 8 || !quote || quote.price <= 0) {
      setNote("not enough bars yet");
      setAsking(false);
      return;
    }

    setPhase(selected, "thinking");
    try {
      const response = await fetch("/api/agents/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbolId: selected,
          bars: bars.slice(-40),
          quote,
          status: market.status[selected] ?? "connecting",
          // An explicit request skips the coalescing window. The hourly cap
          // still applies, and a 429 here is the honest answer.
          force: true,
        }),
      });
      const body = await response.json();
      if (response.status === 423) {
        setPhase(selected, "standby");
        setNote("this agent is stood down — turn it on in Profile");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setVerdict(selected, body);
    } catch (error) {
      setError(selected, String(error).slice(0, 160));
      setNote(String(error).slice(0, 120));
    } finally {
      setAsking(false);
    }
  }

  return (
    <aside
      aria-label={`${spec?.label ?? selected} agent`}
      className={[
        "pointer-events-auto absolute top-1/2 right-6 z-30 w-[24rem] max-w-[calc(100vw-3rem)]",
        "-translate-y-1/2 rounded-2xl border border-white/10 p-6",
        "bg-void/90 backdrop-blur-2xl ring-1 ring-neon-cyan/15 ring-inset",
        "shadow-[0_0_80px_-25px_rgba(0,229,255,0.6)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-neon-magenta uppercase">
            Agent
          </p>
          <h2 className="font-display mt-0.5 text-2xl tracking-[0.16em] text-hud">
            {spec?.label ?? selected}
          </h2>
          {spec?.proxyNote && (
            <p className="font-mono text-[10px] text-hud-dim">{spec.proxyNote}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close"
          className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[11px] text-hud-dim transition hover:border-white/25 hover:text-hud"
        >
          ✕
        </button>
      </div>

      {agent.phase === "thinking" || asking ? (
        <p className="mt-6 font-mono text-sm text-neon-violet">Analysing…</p>
      ) : agent.phase === "standby" ? (
        <p className="mt-6 text-sm text-hud-dim">
          Stood down. Switch this agent on from Profile to hear from it.
        </p>
      ) : agent.phase === "offline" ? (
        <p className="mt-6 text-sm text-amber-300">{agent.error ?? "Agent unavailable."}</p>
      ) : !spoken ? (
        <p className="mt-6 text-sm text-hud-dim">
          This agent has not been asked yet. Analysis runs only when you ask
          for it — press ANALYSE NOW.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <span className={`font-mono text-lg ${stance.tint}`}>
              {stance.glyph} {stance.label}
            </span>
            <span className="font-mono text-[11px] text-hud-dim">
              confidence {agent.confidence.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full ${stance.bar}`}
              style={{ width: `${Math.round(agent.confidence * 100)}%` }}
            />
          </div>

          <p className="mt-5 text-base leading-snug text-hud">{agent.headline}</p>
          <p className="mt-3 text-sm leading-relaxed text-hud-dim">{agent.reasoning}</p>
          {agent.risk && (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 font-mono text-[11px] leading-relaxed text-hud-dim">
              <span className="text-amber-400">risk</span> · {agent.risk}
            </p>
          )}
          <p className="mt-4 font-mono text-[10px] text-hud-dim/70">
            {agent.model} · {new Date(agent.decidedAt).toLocaleTimeString("en-GB")}
          </p>
        </>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={analyseNow}
          disabled={asking || agent.phase === "thinking"}
          className={[
            "rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5",
            "font-mono text-[11px] tracking-[0.16em] text-neon-cyan",
            "transition hover:bg-neon-cyan/20 disabled:opacity-40",
          ].join(" ")}
        >
          {asking ? "ASKING…" : "ANALYSE NOW"}
        </button>
        {note && <span className="font-mono text-[10px] text-hud-dim">{note}</span>}
      </div>
    </aside>
  );
}
