import { NextResponse } from "next/server";
import { intelSnapshot } from "@/lib/intel";

export const runtime = "nodejs";
/** The sources behind this publish daily; their own caches do the throttling. */
export const revalidate = 300;

export async function GET() {
  return NextResponse.json(await intelSnapshot());
}
