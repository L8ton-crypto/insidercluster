import { NextResponse } from "next/server";
import { ensureDb, getSql } from "@/lib/db";
import { searchFilings, fetchAndParse } from "@/lib/edgar";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    await ensureDb();
    const url = new URL(req.url);
    const pages = Math.min(Number(url.searchParams.get("pages") || "3"), 20);
    const days = Math.min(Number(url.searchParams.get("days") || "7"), 30);
    const sql = getSql();

    const enddt = isoDate(new Date());
    const startdt = isoDate(new Date(Date.now() - days * 86400000));

    let scanned = 0;
    let parsed = 0;
    let inserted = 0;
    const errors: string[] = [];

    for (let p = 0; p < pages; p++) {
      let entries;
      try {
        entries = await searchFilings(startdt, enddt, p * 100, 100);
      } catch (e: unknown) {
        errors.push(`efts-${p}: ${(e as Error).message}`);
        break;
      }
      if (entries.length === 0) break;
      scanned += entries.length;

      for (const e of entries) {
        await new Promise(r => setTimeout(r, 80));
        let parts;
        try {
          parts = await fetchAndParse(e);
        } catch (err: unknown) {
          errors.push(`${e.accession}: ${(err as Error).message}`);
          continue;
        }
        parsed += parts.length;
        for (const t of parts) {
          try {
            const r = await sql`
              INSERT INTO ic_filings (
                filing_id, ticker, issuer_name, cik, insider_name, insider_relationship,
                transaction_date, transaction_code, shares, price_per_share, total_value, filing_url
              ) VALUES (
                ${t.filing_id}, ${t.ticker}, ${t.issuer_name}, ${t.cik}, ${t.insider_name}, ${t.insider_relationship},
                ${t.transaction_date}, ${t.transaction_code}, ${t.shares}, ${t.price_per_share}, ${t.total_value}, ${t.filing_url}
              )
              ON CONFLICT (filing_id) DO NOTHING
              RETURNING filing_id
            `;
            if (Array.isArray(r) && r.length) inserted++;
          } catch (err: unknown) {
            errors.push(`insert ${t.filing_id}: ${(err as Error).message}`);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      window: { startdt, enddt },
      scanned_filings: scanned,
      parsed_p_transactions: parsed,
      inserted,
      errors: errors.slice(0, 10),
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
