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
    const { applyBatch, setStatus } = useMarketStore.getState();
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

    return () => {
      buffer.stop();
      for (const p of providers) p.dispose();
    };
  }, []);
}
