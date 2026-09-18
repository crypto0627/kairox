import { backoffDelay, type MarketProvider, type ProviderContext } from "./provider";
import type { SymbolSpec } from "./types";

const WS_BASE = "wss://stream.binance.com:9443/stream?streams=";
const REST_BASE = "https://api.binance.com/api/v3";

interface TickerPayload {
  c: string; // last price
  q: string; // 24h quote volume
}

/**
 * Binance combined-stream provider. Public and keyless — it connects
 * straight from the browser, no route handler in between.
 */
export function createBinanceProvider(
  specs: SymbolSpec[],
  ctx: ProviderContext,
): MarketProvider {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: number | undefined;
  let disposed = false;
  const cleanups: Array<() => void> = [];

  const ids = specs.map((s) => s.id);
  const byStream = new Map<string, SymbolSpec>(
    specs.map((s) => [`${s.remote}@ticker`, s]),
  );

  async function seed() {
    await Promise.all(
      specs.map(async (spec) => {
        try {
          const res = await fetch(
            `${REST_BASE}/ticker/24hr?symbol=${spec.remote.toUpperCase()}`,
          );
          if (!res.ok) return;
          const json = (await res.json()) as {
            lastPrice: string;
            quoteVolume: string;
          };
          ctx.onTick({
            symbolId: spec.id,
            price: Number(json.lastPrice),
            volume: Number(json.quoteVolume),
            ts: Date.now(),
          });
        } catch {
          /* seeding is best-effort; the socket fills in within a second */
        }
      }),
    );
  }

  function open() {
    if (disposed) return;
    ctx.onStatus(ids, attempt === 0 ? "connecting" : "reconnecting");

    const streams = specs.map((s) => `${s.remote}@ticker`).join("/");
    ws = new WebSocket(WS_BASE + streams);

    ws.onopen = () => {
      attempt = 0;
      ctx.onStatus(ids, "open");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          stream?: string;
          data?: TickerPayload;
        };
        if (!msg.stream || !msg.data) return;
        const spec = byStream.get(msg.stream);
        if (!spec) return;
        ctx.onTick({
          symbolId: spec.id,
          price: Number(msg.data.c),
          volume: Number(msg.data.q),
          ts: Date.now(),
        });
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
      if (disposed) return;
      ctx.onStatus(ids, "reconnecting");
      retryTimer = window.setTimeout(open, backoffDelay(attempt++));
    };

    ws.onerror = () => ws?.close();
  }

  return {
    id: "binance",
    connect() {
      void seed();
      open();

      const onVisible = () => {
        if (!document.hidden && (!ws || ws.readyState === WebSocket.CLOSED)) {
          window.clearTimeout(retryTimer);
          open();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      cleanups.push(() =>
        document.removeEventListener("visibilitychange", onVisible),
      );
    },
    dispose() {
      disposed = true;
      window.clearTimeout(retryTimer);
      for (const fn of cleanups) fn();
      cleanups.length = 0;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        ws = null;
      }
    },
  };
}
