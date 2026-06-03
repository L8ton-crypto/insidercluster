import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "InsiderCluster research@leightonrice.co.uk";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "3");
  const enddt = new Date().toISOString().slice(0, 10);
  const startdt = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=&forms=4&dateRange=custom&startdt=${startdt}&enddt=${enddt}&from=0`;
  const r = await fetch(searchUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
  const txt = await r.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { return NextResponse.json({ status: r.status, txt_head: txt.slice(0, 800) }); }
  const first3 = (parsed?.hits?.hits || []).slice(0, 3);
  return NextResponse.json({ status: r.status, total: parsed?.hits?.total, samples: first3 });
}
