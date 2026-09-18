import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { scorePending } from "@/lib/agent/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Grade whatever is past its horizon.
 *
 * Idempotent: applyScore only writes rows that are still ungraded, so calling
 * this from two places at once costs a wasted quote and nothing else.
 */
export async function POST() {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "no database configured" }, { status: 503 });
  }
  try {
    return NextResponse.json(await scorePending());
  } catch (error) {
    return NextResponse.json(
      { error: "scoring failed", detail: String(error).slice(0, 300) },
      { status: 500 },
    );
  }
}
