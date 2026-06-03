import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { computeClusters, healthStats } from "@/lib/clusters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const [clusters, health] = await Promise.all([computeClusters(), healthStats()]);
    return NextResponse.json({ clusters, health });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
