import { NextResponse } from "next/server";
import { searchFilings } from "@/lib/edgar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "InsiderCluster research@leightonrice.co.uk";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || "3");
    const enddt = new Date().toISOString().slice(0, 10);
    const startdt = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const filings = await searchFilings(startdt, enddt, 0, 3);
    if (!filings.length) {
      return NextResponse.json({ ok: true, note: "no filings returned", window: { startdt, enddt } });
    }
    const out: Array<Record<string, unknown>> = [];
    for (const f of filings.slice(0, 3)) {
      const accNoDashes = f.accession.replace(/-/g, "");
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${f.cik}/${accNoDashes}/primary_doc.xml`;
      try {
        const res = await fetch(docUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
        const txt = await res.text();
        out.push({
          accession: f.accession,
          cik: f.cik,
          docUrl,
          status: res.status,
          length: txt.length,
          preview: txt.slice(0, 1500),
        });
      } catch (e: unknown) {
        out.push({ accession: f.accession, error: (e as Error).message });
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return NextResponse.json({ ok: true, window: { startdt, enddt }, samples: out });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
