"use client";

import { useEffect } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";

/** A verdict on an eight-bar window is noise; wait for a real one. */
const MIN_BARS = 8;
/** Fallback cadence, used until the floor's own settings arrive. */
const DEFAULT_CYCLE_MS = 5 * 60_000;
/** First pass shortly after the back-fill lands, not on the very first frame. */
const FIRST_RUN_MS = 6_000;

/**
 * Drives the agent floor.
 *
 * One symbol at a time, in order. The server serialises inference anyway — an
 * 8B model holds several gigabytes resident and answers in about nine seconds
 * — so firing five requests at once would only queue them somewhere less
 * visible. Sequential here means the robots come alive one after another,
 * which also reads better than five simultaneous reactions.
 */
/**
 * Module-level claim, so a remount cannot leave two schedulers running. The
 * server enforces the same rule independently — this just keeps the network
 * quiet.
 */
let floorClaimed = false;

export function useAgentFloor() {
  useEffect(() => {
    if (floorClaimed) return;
    floorClaimed = true;
    let live = true;
    const { setPhase, setVerdict, setError } = useAgentStore.getState();

    async function askOne(symbolId: string) {
      const market = useMarketStore.getState();
      const bars = market.candles[symbolId] ?? [];
      const quote = market.quotes[symbolId];
      if (bars.length < MIN_BARS || !quote || quote.price <= 0) return;

      setPhase(symbolId, "thinking");
      try {
        const response = await fetch("/api/agents/verdict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            symbolId,
            bars: bars.slice(-40),
            quote,
            status: market.status[symbolId] ?? "connecting",
          }),
        });
        // 423 is configuration, not failure: the agent was stood down from
        // the Profile page and should look it.
        if (response.status === 423) {
          if (live) setPhase(symbolId, "standby");
          return;
        }
        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(detail.error ?? `HTTP ${response.status}`);
        }
        const verdict = await response.json();
        if (live) setVerdict(symbolId, verdict);
      } catch (error) {
        if (live) setError(symbolId, String(error).slice(0, 160));
      }
    }

    /** Grade whatever has come due. Cheap, idempotent, and it means the
     *  History page is current without anyone pressing anything. */
    async function score() {
      try {
        await fetch("/api/agents/score", { method: "POST" });
      } catch {
        /* the scorer being down does not stop the floor reporting */
      }
    }

    async function cycle() {
      for (const spec of SYMBOLS) {
        if (!live) return;
        await askOne(spec.id);
      }
      if (live) await score();
    }

    let repeat: number | undefined;

    /** Cadence is a setting, not a constant — Profile owns it. */
    async function schedule() {
      let cycleMs = DEFAULT_CYCLE_MS;
      try {
        const response = await fetch("/api/floor/config");
        if (response.ok) {
          const body = (await response.json()) as { floor?: { cycleMinutes?: number } };
          const minutes = body.floor?.cycleMinutes;
          if (typeof minutes === "number" && minutes > 0) cycleMs = minutes * 60_000;
        }
      } catch {
        /* defaults are fine */
      }
      if (live) repeat = window.setInterval(() => void cycle(), cycleMs);
    }

    const first = window.setTimeout(() => {
      void cycle();
      void schedule();
    }, FIRST_RUN_MS);

    return () => {
      live = false;
      floorClaimed = false;
      window.clearTimeout(first);
      if (repeat !== undefined) window.clearInterval(repeat);
    };
  }, []);
}
