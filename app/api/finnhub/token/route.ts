import { NextResponse } from "next/server";
import { SYMBOLS } from "@/lib/market/symbols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(
  SYMBOLS.filter((s) => s.provider === "finnhub").map((s) => s.remote.toUpperCase()),
);

/**
 * Mints the Finnhub socket URL server-side so FINNHUB_API_KEY never ships
 * to the client bundle, and only for symbols this app actually displays.
 *
 * Note: the key is still present in the returned URL, which a determined
 * user can read from devtools. If the key needs real protection, replace
 * this with a server-side relay socket — the provider interface does not
 * change.
 */
export async function POST(request: Request) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let symbols: unknown;
  try {
    ({ symbols } = (await request.json()) as { symbols?: unknown });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  const rejected = symbols.filter(
    (s) => typeof s !== "string" || !ALLOWED.has(s.toUpperCase()),
  );
  if (rejected.length) {
    return NextResponse.json(
      { error: "symbol not allowed", rejected },
      { status: 403 },
    );
  }

  return NextResponse.json({
    url: `wss://ws.finnhub.io?token=${encodeURIComponent(key)}`,
  });
}
