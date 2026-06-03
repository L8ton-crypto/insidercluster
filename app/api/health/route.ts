import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { healthStats, computeClusters } from "@/lib/clusters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const [health, clusters] = await Promise.all([healthStats(), computeClusters()]);
    return NextResponse.json({ ok: true, health, cluster_count: clusters.length });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
