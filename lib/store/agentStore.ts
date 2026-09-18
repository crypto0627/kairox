import { create } from "zustand";
import type { Stance } from "@/lib/agent/types";

/**
 * "offline" means the agent could not answer; "standby" means it was told not
 * to. Collapsing the two made a deliberate setting read as a fault on the
 * floor — the panel said AGENT OFFLINE with "Error: agent disabled" under it.
 */
export type AgentPhase = "idle" | "thinking" | "spoken" | "offline" | "standby";

export interface AgentState {
  phase: AgentPhase;
  stance: Stance;
  confidence: number;
  headline: string;
  reasoning: string;
  risk: string;
  model: string;
  decidedAt: number;
  error: string | null;
}

const EMPTY: AgentState = {
  phase: "idle",
  stance: "flat",
  confidence: 0,
  headline: "",
  reasoning: "",
  risk: "",
  model: "",
  decidedAt: 0,
  error: null,
};

interface AgentStore {
  agents: Record<string, AgentState>;
  /** The trader the user has clicked, or null. Drives the DOM inspector. */
  selected: string | null;
  select: (symbolId: string | null) => void;
  setPhase: (symbolId: string, phase: AgentPhase) => void;
  setVerdict: (symbolId: string, verdict: Partial<AgentState>) => void;
  setError: (symbolId: string, error: string) => void;
}

/**
 * What the five agents currently think.
 *
 * Kept apart from the market store on purpose: prices flush every 5 s and
 * verdicts land every few minutes, and a component that wants one should not
 * re-render for the other.
 */
export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selected: null,

  select: (symbolId) =>
    set((state) => ({ selected: state.selected === symbolId ? null : symbolId })),

  setPhase: (symbolId, phase) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [symbolId]: { ...EMPTY, ...state.agents[symbolId], phase },
      },
    })),

  setVerdict: (symbolId, verdict) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [symbolId]: {
          ...EMPTY,
          ...state.agents[symbolId],
          ...verdict,
          phase: "spoken",
          error: null,
          decidedAt: Date.now(),
        },
      },
    })),

  setError: (symbolId, error) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [symbolId]: { ...EMPTY, ...state.agents[symbolId], phase: "offline", error },
      },
    })),
}));

export function agentOf(agents: Record<string, AgentState>, symbolId: string): AgentState {
  return agents[symbolId] ?? EMPTY;
}
