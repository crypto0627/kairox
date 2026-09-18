"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SYMBOLS } from "@/lib/market/symbols";
import { useMarketStore } from "@/lib/store/marketStore";

/**
 * Asks the supervisor for a read across the whole floor.
 *
 * The snapshot is gathered here because the browser is what holds it — the
 * same reason the per-agent call works this way. Instruments without enough
 * bars are left out rather than padded, and the route refuses to write a
 * "cross-instrument" report on fewer than two.
 */
export function WriteReportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setNote(null);
    const market = useMarketStore.getState();

    const instruments = SYMBOLS.map((spec) => ({
      symbolId: spec.id,
      bars: (market.candles[spec.id] ?? []).slice(-40),
      quote: market.quotes[spec.id],
      status: market.status[spec.id] ?? "connecting",
    })).filter((item) => item.bars.length >= 8 && (item.quote?.price ?? 0) > 0);

    if (instruments.length < 2) {
      setNote("waiting for the panels to fill — open the dashboard first");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/agents/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruments }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setNote(`written in ${(body.latencyMs / 1000).toFixed(1)}s`);
      startTransition(() => router.refresh());
    } catch (error) {
      setNote(String(error).slice(0, 140));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={write}
        disabled={busy || pending}
        className={[
          "rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-2",
          "font-mono text-[11px] tracking-[0.16em] text-neon-cyan",
          "transition hover:bg-neon-cyan/20 disabled:opacity-40",
        ].join(" ")}
      >
        {busy ? "WRITING…" : "WRITE REPORT"}
      </button>
      {note && <span className="font-mono text-[10px] text-hud-dim">{note}</span>}
    </div>
  );
}
