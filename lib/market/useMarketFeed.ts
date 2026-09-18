"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/lib/store/marketStore";
import { createBinanceProvider } from "./binance";
import { createFinnhubProvider } from "./finnhub";
import { createSimulatedProvider } from "./simulated";
import { isUsMarketOpen, SYMBOLS } from "./symbols";
import type { MarketProvider, ProviderContext } from "./provider";
import { TickBuffer } from "./throttle";

const FLUSH_MS = 5_000;

/**
 * Boots every provider once, wires them through the 5s throttle into the
 * store, and tears the whole thing down on unmount.
 *
 * Mounted from the shell layout, so it survives route changes.
 */
export function useMarketFeed() {
  useEffect(() => {
    const { applyBatch, seedCandles, setStatus } = useMarketStore.getState();
    const retryTimers: number[] = [];
    const buffer = new TickBuffer(FLUSH_MS, applyBatch);

    const ctx: ProviderContext = {
      onTick: (tick) => buffer.push(tick),
      onStatus: setStatus,
    };

    const providers: MarketProvider[] = [];

    const crypto = SYMBOLS.filter((s) => s.provider === "binance");
    if (crypto.length) providers.push(createBinanceProvider(crypto, ctx));

    const equities = SYMBOLS.filter((s) => s.provider === "finnhub");
    if (equities.length) {
      // Outside cash hours a real socket is silent, which looks identical to
      // a broken one. Run the simulator instead and label it in the HUD.
      providers.push(
        isUsMarketOpen()
          ? createFinnhubProvider(equities, ctx)
          : createSimulatedProvider(equities, ctx),
      );
    }

    for (const p of providers) p.connect();
    buffer.start();

    /**
     * Back-fill runs beside the sockets, not before them: a slow or failed
     * history request must never hold up live prices.
     *
     * One retry, because losing it is expensive — without history a panel
     * needs forty minutes to draw its window, and a single DNS blip on the
     * REST call is enough to cost that while the socket connects fine.
     *
     * The result is applied even if the effect has since torn down. The store
     * is module-level and `seedCandles` only prepends bars older than what is
     * held, so a late arrival is harmless — and discarding it would throw
     * away a good fetch every time StrictMode double-mounts.
     */
    async function backfill(provider: MarketProvider, attempt = 0): Promise<void> {
      if (!provider.history) return;
      try {
        const seed = await provider.history();
        if (seed.size) {
          seedCandles(seed);
          return;
        }
      } catch {
        /* fall through to the retry */
      }
      if (attempt === 0) {
        retryTimers.push(window.setTimeout(() => void backfill(provider, 1), 4_000));
      }
    }

    for (const p of providers) void backfill(p);

    return () => {
      for (const t of retryTimers) window.clearTimeout(t);
      buffer.stop();
      for (const p of providers) p.dispose();
    };
  }, []);
}
