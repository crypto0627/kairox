"use client";

import { useEffect } from "react";

/** Fallback sweep cadence, used until the floor's own settings arrive. */
const DEFAULT_SWEEP_MS = 5 * 60_000;
const FIRST_RUN_MS = 8_000;

/**
 * Module-level claim, so a remount cannot leave two sweeps running.
 */
let claimed = false;

/**
 * Grades verdicts whose horizon has elapsed. It does not ask any agent
 * anything.
 *
 * The floor used to analyse on a timer. It does not any more: a verdict is
 * produced when someone asks for one, from the inspector's ANALYSE NOW. A
 * model that runs unattended costs either ten seconds of a laptop or real
 * money per call, and it was spending both to tell an empty room that four
 * simulated feeds had no clear trend.
 *
 * Scoring stays on a timer because it costs neither: it is one REST quote per
 * instrument with anything due, and without it the accuracy figures only move
 * when somebody happens to open the History page.
 */
export function useVerdictScoring() {
  useEffect(() => {
    if (claimed) return;
    claimed = true;
    let live = true;
    let repeat: number | undefined;

    async function sweep() {
      try {
        await fetch("/api/agents/score", { method: "POST" });
      } catch {
        /* the scorer being down changes nothing on the floor */
      }
    }

    async function schedule() {
      let sweepMs = DEFAULT_SWEEP_MS;
      try {
        const response = await fetch("/api/floor/config");
        if (response.ok) {
          const body = (await response.json()) as { floor?: { cycleMinutes?: number } };
          const minutes = body.floor?.cycleMinutes;
          if (typeof minutes === "number" && minutes > 0) sweepMs = minutes * 60_000;
        }
      } catch {
        /* defaults are fine */
      }
      if (live) repeat = window.setInterval(() => void sweep(), sweepMs);
    }

    const first = window.setTimeout(() => {
      void sweep();
      void schedule();
    }, FIRST_RUN_MS);

    return () => {
      live = false;
      claimed = false;
      window.clearTimeout(first);
      if (repeat !== undefined) window.clearInterval(repeat);
    };
  }, []);
}
