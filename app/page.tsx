import { ensureDb } from "@/lib/db";
import { computeClusters, healthStats, type Cluster } from "@/lib/clusters";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function ClusterCard({ c }: { c: Cluster }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{c.ticker}</h2>
            <span className="text-sm text-zinc-500 truncate max-w-[14rem] sm:max-w-[20rem]">{c.issuer_name || ""}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {c.insider_count} insiders, {fmtDate(c.first_date)} to {fmtDate(c.last_date)} ({c.span_days}d window)
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400">{fmtMoney(c.total_value)}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">code P, open market</div>
        </div>
      </header>

      <ul className="mt-4 divide-y divide-zinc-800/80 border-t border-zinc-800/80">
        {c.members.map((m, i) => (
          <li key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-200">{m.insider_name}</div>
              {m.insider_relationship ? (
                <div className="truncate text-xs text-zinc-500">{m.insider_relationship}</div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 sm:justify-end">
              <span>{fmtDate(m.transaction_date)}</span>
              <span>{m.shares.toLocaleString()} sh @ ${m.price_per_share.toFixed(2)}</span>
              <span className="font-medium text-zinc-200">{fmtMoney(m.total_value)}</span>
              <a href={m.filing_url} target="_blank" rel="noopener" className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
                EDGAR
              </a>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default async function Page() {
  await ensureDb();
  const [clusters, health] = await Promise.all([computeClusters(), healthStats()]);

  const bootstrapping = health.p_30d < 50;
  const lastFetched = health.last_fetched ? new Date(health.last_fetched).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="text-emerald-400">Insider</span>Cluster
            </h1>
            <Link href="/about" className="text-sm text-zinc-400 hover:text-zinc-200">
              About
            </Link>
          </div>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            SEC Form 4 cluster buys. Code-P open-market purchases only. 3+ insiders in any 14-day window. Free, no email, no paywall.
          </p>
        </header>

        {bootstrapping ? (
          <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
            Bootstrapping. {health.p_30d} code-P transactions in the last 30 days so far. The daily cron at 06:00 UTC builds the dataset over the next week.
          </div>
        ) : null}

        {clusters.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
            No clusters in the last 30 days that clear the 3-insider, 14-day threshold. That is itself a signal. Insider buying is rare. Most quarters produce a handful of qualifying tickers, not dozens.
          </div>
        ) : (
          <div className="space-y-4">
            {clusters.map(c => <ClusterCard key={c.ticker} c={c} />)}
          </div>
        )}

        <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {health.p_30d} code-P filings in window, {health.total_filings} total ingested. Last fetch {lastFetched}.
            </span>
            <span>
              Source: <a href="https://www.sec.gov/edgar/searchedgar/edgarfulltextfaq" target="_blank" rel="noopener" className="hover:text-zinc-300 underline-offset-2 hover:underline">SEC EDGAR</a>. Not investment advice.
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
