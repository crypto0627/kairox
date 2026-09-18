import type { FeedStatus, Tick } from "./types";

export type TickHandler = (tick: Tick) => void;
export type StatusHandler = (symbolIds: string[], status: FeedStatus) => void;

export interface MarketProvider {
  readonly id: string;
  /** Opens the transport and begins emitting ticks. */
  connect(): void;
  /** Tears everything down; safe to call twice. */
  dispose(): void;
}

export interface ProviderContext {
  onTick: TickHandler;
  onStatus: StatusHandler;
}

/** Exponential backoff with jitter, capped at 30s. */
export function backoffDelay(attempt: number): number {
  const base = Math.min(30_000, 1_000 * 2 ** attempt);
  return base * (0.7 + Math.random() * 0.6);
}
