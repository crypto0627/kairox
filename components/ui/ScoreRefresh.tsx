"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Grades whatever is past its horizon, then reloads the page's data.
 *
 * The floor does this on its own schedule; the button is for when you want to
 * see a call resolve without waiting for the next cycle.
 */
export function ScoreRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/agents/score", { method: "POST" });
      const body = (await response.json()) as {
        graded?: number;
        skipped?: number;
        error?: string;
      };
      setNote(
        body.error
          ? body.error
          : body.graded
            ? `graded ${body.graded}${body.skipped ? `, skipped ${body.skipped}` : ""}`
            : "nothing was due",
      );
      startTransition(() => router.refresh());
    } catch (error) {
      setNote(String(error).slice(0, 80));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy || pending}
        className={[
          "rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5",
          "font-mono text-[11px] tracking-[0.16em] text-neon-cyan",
          "transition hover:bg-neon-cyan/20 disabled:opacity-40",
        ].join(" ")}
      >
        {busy || pending ? "SCORING…" : "SCORE NOW"}
      </button>
      {note && <span className="font-mono text-[10px] text-hud-dim">{note}</span>}
    </div>
  );
}
