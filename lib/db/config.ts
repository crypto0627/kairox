import "server-only";
import { db } from "./client";
import { SYMBOLS } from "@/lib/market/symbols";

export interface AgentConfig {
  symbolId: string;
  persona: string;
  enabled: boolean;
}

export interface FloorConfig {
  cycleMinutes: number;
  hourlyCap: number;
}

export interface FloorSettings {
  floor: FloorConfig;
  agents: AgentConfig[];
}

export const DEFAULT_FLOOR: FloorConfig = { cycleMinutes: 5, hourlyCap: 60 };

/** Settings for every instrument on the floor, defaults filled in for any
 *  that has never been configured. */
export async function readSettings(): Promise<FloorSettings> {
  const [floorRows, agentRows] = await Promise.all([
    db<FloorConfig[]>`
      select cycle_minutes as "cycleMinutes", hourly_cap as "hourlyCap"
      from floor_config where id = true
    `,
    db<AgentConfig[]>`
      select symbol_id as "symbolId", persona, enabled from agent_config
    `,
  ]);

  const configured = new Map(agentRows.map((row) => [row.symbolId, row]));
  return {
    floor: floorRows[0] ?? DEFAULT_FLOOR,
    agents: SYMBOLS.map(
      (spec) =>
        configured.get(spec.id) ?? { symbolId: spec.id, persona: "", enabled: true },
    ),
  };
}

/** Just the persona, for the prompt. Empty when unset. */
export async function personaFor(symbolId: string): Promise<string> {
  const rows = await db<{ persona: string; enabled: boolean }[]>`
    select persona, enabled from agent_config where symbol_id = ${symbolId}
  `;
  const row = rows[0];
  return row?.enabled === false ? "" : (row?.persona ?? "");
}

/** Whether this agent is switched on. An unconfigured agent runs. */
export async function isEnabled(symbolId: string): Promise<boolean> {
  const rows = await db<{ enabled: boolean }[]>`
    select enabled from agent_config where symbol_id = ${symbolId}
  `;
  return rows[0]?.enabled ?? true;
}

export async function writeSettings(input: FloorSettings): Promise<FloorSettings> {
  await db.begin(async (tx) => {
    await tx`
      update floor_config
         set cycle_minutes = ${input.floor.cycleMinutes},
             hourly_cap    = ${input.floor.hourlyCap},
             updated_at    = now()
       where id = true
    `;
    for (const agent of input.agents) {
      await tx`
        insert into agent_config (symbol_id, persona, enabled)
        values (${agent.symbolId}, ${agent.persona}, ${agent.enabled})
        on conflict (symbol_id) do update
          set persona = excluded.persona,
              enabled = excluded.enabled,
              updated_at = now()
      `;
    }
  });
  return readSettings();
}
