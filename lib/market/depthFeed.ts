"use client";

import { useEffect } from "react";

export interface BookLevel {
  price: number;
  qty: number;
  /** Running total from the mid outwards, which is what the wall's height is. */
  cumulative: number;
}

export interface Book {
  bids: BookLevel[];
  asks: BookLevel[];
  mid: number;
  spread: number;
  at: number;
  source: "stream" | "poll";
}

/**
 * The order book, held outside React entirely.
 *
 * It arrives ten times a second. Putting that through a store — even one
 * nothing subscribes to reactively — is more machinery than a mutable
 * snapshot the render loop reads, and this floor follows the same rule as the
 * trading floor: market data never re-renders the 3D tree.
 */
let book: Book | null = null;

export function currentBook(): Book | null {
  return book;
}

const DEPTH = 20;

function ladder(rows: [string, string][], descending: boolean): BookLevel[] {
  const levels = rows
    .map(([price, qty]) => ({ price: Number(price), qty: Number(qty), cumulative: 0 }))
    .filter((level) => Number.isFinite(level.price) && level.qty > 0)
    .sort((a, b) => (descending ? b.price - a.price : a.price - b.price))
    .slice(0, DEPTH);

  let running = 0;
  for (const level of levels) {
    running += level.qty;
    level.cumulative = running;
  }
  return levels;
}

function absorb(bids: [string, string][], asks: [string, string][], source: Book["source"]) {
  const bidSide = ladder(bids, true);
  const askSide = ladder(asks, false);
  if (!bidSide.length || !askSide.length) return;

  book = {
    bids: bidSide,
    asks: askSide,
    mid: (bidSide[0].price + askSide[0].price) / 2,
    spread: askSide[0].price - bidSide[0].price,
    at: Date.now(),
    source,
  };
}

/**
 * Streams the book, and falls back to polling if the socket will not hold.
 *
 * The fallback is not defensive decoration: the websocket to Binance drops
 * regularly on some networks while plain REST to the same host answers fine,
 * which is a state this project has hit repeatedly. A wall that is two
 * seconds stale still shows where the liquidity is; an empty one shows
 * nothing.
 */
export function useDepthFeed(symbol = "btcusdt") {
  useEffect(() => {
    let live = true;
    let socket: WebSocket | null = null;
    let poll: number | undefined;

    async function pollOnce() {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${DEPTH}`,
        );
        if (!response.ok) return;
        const json = (await response.json()) as {
          bids: [string, string][];
          asks: [string, string][];
        };
        if (live) absorb(json.bids, json.asks, "poll");
      } catch {
        /* the wall keeps the last book it had and says how old it is */
      }
    }

    function startPolling() {
      if (poll !== undefined || !live) return;
      void pollOnce();
      poll = window.setInterval(() => void pollOnce(), 2_000);
    }

    // Seed immediately so the wall is never empty while the socket handshakes.
    void pollOnce();

    try {
      socket = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol}@depth${DEPTH}@100ms`,
      );
      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data as string) as {
            bids?: [string, string][];
            asks?: [string, string][];
          };
          if (!frame.bids || !frame.asks) return;
          // The stream is authoritative; stop paying for polls.
          if (poll !== undefined) {
            window.clearInterval(poll);
            poll = undefined;
          }
          absorb(frame.bids, frame.asks, "stream");
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (live) startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      live = false;
      if (poll !== undefined) window.clearInterval(poll);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
      book = null;
    };
  }, [symbol]);
}
