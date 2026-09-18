"use client";

import { useState } from "react";
import { SYMBOLS } from "@/lib/market/symbols";

interface AgentConfig {
  symbolId: string;
  persona: string;
  enabled: boolean;
}

export interface Settings {
  floor: { cycleMinutes: number; hourlyCap: number };
  agents: AgentConfig[];
  callsThisHour: number;
  provider: { id: string; model: string };
  persisted: boolean;
}

const PRESETS = [
  "Conservative. Prefer flat unless the move is unambiguous.",
  "Momentum. Favour continuation of an established trend.",
  "Mean-reverting. Fade moves that stretch far from the window's average.",
];

const field =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm " +
  "text-hud outline-none focus:border-neon-cyan/50";

/**
 * The settings arrive from the server component that renders this, rather
 * than from a fetch on mount. No loading flash, no effect that sets state the
 * moment it runs — and the page is already dynamic, so there is nothing to
 * gain from asking twice.
 */
export function FloorSettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/floor/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ floor: settings.floor, agents: settings.agents }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setSettings(body as Settings);
      setStatus("saved");
    } catch (error) {
      setStatus(String(error).slice(0, 160));
    } finally {
      setSaving(false);
    }
  }

  const { cycleMinutes, hourlyCap } = settings.floor;
  const enabledCount = settings.agents.filter((a) => a.enabled).length;
  const remaining = Math.max(0, hourlyCap - settings.callsThisHour);

  const patch = (next: Partial<Settings>) => setSettings({ ...settings, ...next });
  const patchAgent = (symbolId: string, change: Partial<AgentConfig>) =>
    patch({
      agents: settings.agents.map((a) => (a.symbolId === symbolId ? { ...a, ...change } : a)),
    });

  return (
    <div className="mt-8 flex flex-col gap-10">
      {!settings.persisted && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
          No database is configured, so these are defaults and nothing you change
          here will be kept.
        </p>
      )}

      <section>
        <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
          Floor
        </h2>

        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-hud-dim">Scoring sweep (minutes)</span>
            <input
              type="number"
              min={1}
              max={240}
              value={cycleMinutes}
              onChange={(e) =>
                patch({ floor: { ...settings.floor, cycleMinutes: Number(e.target.value) } })
              }
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-hud-dim">Hourly call cap</span>
            <input
              type="number"
              min={0}
              max={2000}
              value={hourlyCap}
              onChange={(e) =>
                patch({ floor: { ...settings.floor, hourlyCap: Number(e.target.value) } })
              }
              className={field}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-hud-dim">Used this hour</span>
            <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-hud">
              {settings.callsThisHour} / {hourlyCap}
            </p>
          </div>
        </div>

        <p
          className={[
            "mt-3 font-mono text-[11px]",
            remaining === 0 ? "text-neon-magenta" : "text-hud-dim",
          ].join(" ")}
        >
          {remaining === 0
            ? "Budget spent — ANALYSE NOW will be refused until the hour rolls."
            : `${remaining} analyses left this hour, across ${enabledCount} agent${
                enabledCount === 1 ? "" : "s"
              } on duty.`}
        </p>
        <p className="mt-1 font-mono text-[10px] text-hud-dim/70">
          The sweep only grades calls whose horizon has passed; it never asks an
          agent anything. Analysis runs when you press ANALYSE NOW on a trader,
          and that is what the cap counts.
        </p>

        <p className="mt-2 font-mono text-[10px] text-hud-dim/70">
          Answering now: {settings.provider.id} · {settings.provider.model}. The
          provider is set by AGENT_PROVIDER in the environment, not from here — a
          page that could switch to a billed model with one click is a page that
          will, by accident.
        </p>
      </section>

      <section>
        <h2 className="font-mono text-[10px] tracking-[0.3em] text-hud-dim uppercase">
          Agents
        </h2>
        <p className="mt-2 text-xs text-hud-dim">
          A mandate is appended to the agent&apos;s instructions. Leave it empty and
          it reads the tape with no particular bias.
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {settings.agents.map((agent) => {
            const spec = SYMBOLS.find((s) => s.id === agent.symbolId);
            return (
              <li
                key={agent.symbolId}
                className="rounded-xl border border-white/10 bg-white/[0.05] p-4 ring-1 ring-white/5 ring-inset"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-sm tracking-[0.14em] text-hud">
                    {spec?.label ?? agent.symbolId}
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agent.enabled}
                      onChange={(e) =>
                        patchAgent(agent.symbolId, { enabled: e.target.checked })
                      }
                      className="h-3.5 w-3.5 accent-[#00e5ff]"
                    />
                    <span className="font-mono text-[11px] text-hud-dim">
                      {agent.enabled ? "on duty" : "stood down"}
                    </span>
                  </label>
                </div>

                <textarea
                  rows={2}
                  maxLength={400}
                  value={agent.persona}
                  placeholder="Mandate — e.g. conservative, only call a direction when it is unambiguous."
                  onChange={(e) => patchAgent(agent.symbolId, { persona: e.target.value })}
                  className={`${field} mt-3 resize-y`}
                />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => patchAgent(agent.symbolId, { persona: preset })}
                      className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-hud-dim transition hover:border-neon-cyan/40 hover:text-neon-cyan"
                    >
                      {preset.split(".")[0]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={[
            "rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-2",
            "font-mono text-[11px] tracking-[0.16em] text-neon-cyan",
            "transition hover:bg-neon-cyan/20 disabled:opacity-40",
          ].join(" ")}
        >
          {saving ? "SAVING…" : "SAVE"}
        </button>
        {status && <span className="font-mono text-[11px] text-hud-dim">{status}</span>}
      </div>
    </div>
  );
}
