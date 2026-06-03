import { getSql } from "./db";

export type FilingRow = {
  filing_id: string;
  ticker: string;
  issuer_name: string | null;
  cik: string;
  insider_name: string | null;
  insider_relationship: string | null;
  transaction_date: string;
  shares: number;
  price_per_share: number;
  total_value: number;
  filing_url: string;
};

export type ClusterMember = {
  insider_name: string;
  insider_relationship: string | null;
  transaction_date: string;
  shares: number;
  price_per_share: number;
  total_value: number;
  filing_url: string;
};

export type Cluster = {
  ticker: string;
  issuer_name: string | null;
  insider_count: number;
  total_value: number;
  first_date: string;
  last_date: string;
  span_days: number;
  members: ClusterMember[];
};

// Pull last-30-day code-P filings, group by ticker, find any 14-day window with 3+ distinct insiders.
// For a buildable cluster we keep the window that maximises distinct-insider count then total value.
export async function computeClusters(): Promise<Cluster[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      filing_id,
      ticker,
      issuer_name,
      cik,
      insider_name,
      insider_relationship,
      transaction_date::text AS transaction_date,
      shares::float8 AS shares,
      price_per_share::float8 AS price_per_share,
      total_value::float8 AS total_value,
      filing_url
    FROM ic_filings
    WHERE transaction_code = 'P'
      AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'
      AND ticker IS NOT NULL
      AND ticker NOT IN ('NA','N','NONE','TBD')
      AND LENGTH(ticker) BETWEEN 1 AND 6
      AND total_value IS NOT NULL
      AND total_value > 0
    ORDER BY ticker, transaction_date
  `) as unknown as FilingRow[];

  const byTicker = new Map<string, FilingRow[]>();
  for (const r of rows) {
    const arr = byTicker.get(r.ticker) || [];
    arr.push(r);
    byTicker.set(r.ticker, arr);
  }

  const out: Cluster[] = [];
  for (const [ticker, list] of byTicker) {
    list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    let best: Cluster | null = null;

    for (let i = 0; i < list.length; i++) {
      const startTs = Date.parse(list[i].transaction_date + "T00:00:00Z");
      const cutoff = startTs + 14 * 86400000;
      const win: FilingRow[] = [];
      for (let j = i; j < list.length; j++) {
        const ts = Date.parse(list[j].transaction_date + "T00:00:00Z");
        if (ts > cutoff) break;
        win.push(list[j]);
      }
      const distinctInsiders = new Set(win.map(w => (w.insider_name || "").trim()).filter(Boolean));
      if (distinctInsiders.size < 3) continue;
      const total = win.reduce((acc, w) => acc + (w.total_value || 0), 0);
      const candidate: Cluster = {
        ticker,
        issuer_name: list[i].issuer_name,
        insider_count: distinctInsiders.size,
        total_value: Math.round(total * 100) / 100,
        first_date: win[0].transaction_date,
        last_date: win[win.length - 1].transaction_date,
        span_days: Math.round((Date.parse(win[win.length - 1].transaction_date) - Date.parse(win[0].transaction_date)) / 86400000),
        members: win.map(w => ({
          insider_name: w.insider_name || "Unknown",
          insider_relationship: w.insider_relationship,
          transaction_date: w.transaction_date,
          shares: w.shares,
          price_per_share: w.price_per_share,
          total_value: w.total_value,
          filing_url: w.filing_url,
        })),
      };
      if (!best || candidate.insider_count > best.insider_count || (candidate.insider_count === best.insider_count && candidate.total_value > best.total_value)) {
        best = candidate;
      }
    }
    if (best) out.push(best);
  }

  out.sort((a, b) => b.total_value - a.total_value);
  return out;
}

export async function healthStats() {
  const sql = getSql();
  const counts = (await sql`
    SELECT
      COUNT(*)::int AS total_filings,
      COUNT(*) FILTER (WHERE transaction_code = 'P')::int AS p_filings,
      COUNT(*) FILTER (WHERE transaction_code = 'P' AND transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS p_30d,
      MAX(fetched_at)::text AS last_fetched
    FROM ic_filings
  `) as unknown as Array<{ total_filings: number; p_filings: number; p_30d: number; last_fetched: string | null }>;
  return counts[0] || { total_filings: 0, p_filings: 0, p_30d: 0, last_fetched: null };
}
