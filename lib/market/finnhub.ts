import { backoffDelay, type MarketProvider, type ProviderContext } from "./provider";
import { SYMBOL_BY_REMOTE } from "./symbols";
import type { SymbolSpec } from "./types";

interface TradeFrame {
  type: string;
  data?: Array<{ s: string; p: number; v: number; t: number }>;
}

/**
 * Finnhub trade-stream provider.
 *
 * The API key never reaches the client: the browser asks /api/finnhub/token
 * for a socket URL, and the route handler refuses to mint one unless the
 * requested symbols are on its allowlist.
 */
export function createFinnhubProvider(
  specs: SymbolSpec[],
  ctx: ProviderContext,
): MarketProvider {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: number | undefined;
  let disposed = false;

  const ids = specs.map((s) => s.id);
  const remotes = specs.map((s) => s.remote);

  async function open() {
    if (disposed) return;
    ctx.onStatus(ids, attempt === 0 ? "connecting" : "reconnecting");

    let url: string;
    try {
      const res = await fetch("/api/finnhub/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols: remotes }),
      });
      if (!res.ok) throw new Error(`token ${res.status}`);
      ({ url } = (await res.json()) as { url: string });
    } catch {
      ctx.onStatus(ids, "closed");
      return;
    }

    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      ctx.onStatus(ids, "open");
      for (const remote of remotes) {
        ws?.send(JSON.stringify({ type: "subscribe", symbol: remote }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as TradeFrame;
        if (frame.type === "ping") {
          ws?.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (frame.type !== "trade" || !frame.data) return;
        for (const trade of frame.data) {
          const spec = SYMBOL_BY_REMOTE.get(trade.s.toUpperCase());
          if (!spec) continue;
          ctx.onTick({
            symbolId: spec.id,
            price: trade.p,
            volume: trade.v,
            ts: trade.t,
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
      if (disposed) return;
      ctx.onStatus(ids, "reconnecting");
      retryTimer = window.setTimeout(() => void open(), backoffDelay(attempt++));
    };

    ws.onerror = () => ws?.close();
  }

  return {
    id: "finnhub",
    connect() {
      void open();
    },
    dispose() {
      disposed = true;
      window.clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        for (const remote of remotes) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "unsubscribe", symbol: remote }));
          }
        }
        ws.close();
        ws = null;
      }
    },
  };
}
