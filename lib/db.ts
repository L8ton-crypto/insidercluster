import { neon } from "@neondatabase/serverless";

let ready = false;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  return neon(url);
}

export async function ensureDb() {
  if (ready) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ic_filings (
      filing_id TEXT PRIMARY KEY,
      ticker TEXT,
      issuer_name TEXT,
      cik TEXT,
      insider_name TEXT,
      insider_relationship TEXT,
      transaction_date DATE,
      transaction_code TEXT,
      shares NUMERIC,
      price_per_share NUMERIC,
      total_value NUMERIC,
      filing_url TEXT,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ic_filings_ticker_idx ON ic_filings(ticker)`;
  await sql`CREATE INDEX IF NOT EXISTS ic_filings_tx_date_idx ON ic_filings(transaction_date)`;
  await sql`CREATE INDEX IF NOT EXISTS ic_filings_code_idx ON ic_filings(transaction_code)`;
  ready = true;
}
