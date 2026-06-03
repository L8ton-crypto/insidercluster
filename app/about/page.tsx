import Link from "next/link";

export const metadata = {
  title: "About - InsiderCluster",
  description: "Why code-P only, what a cluster is, what the data does not say.",
};

export default function About() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">&larr; Back to clusters</Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">About InsiderCluster</h1>
        </header>

        <section className="prose prose-invert max-w-none space-y-6 text-zinc-300">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Why only code P</h2>
            <p className="mt-2 text-sm leading-6">
              Form 4 covers every change in insider holdings. Most of those changes are not signal. Option exercises, restricted stock vesting, gifts, 10b5-1 plan sales and tax-withholding sells are recorded with codes M, A, G, S and F respectively. None of them tell you the insider has decided this is a good price.
            </p>
            <p className="mt-2 text-sm leading-6">
              Code P is the one that does. It means an open-market purchase. The insider walked into a brokerage, used personal money to buy stock. That is the filing academics study and the one due-diligence accounts on FinTwit watch. Everything else is noise on this site.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-100">What counts as a cluster</h2>
            <p className="mt-2 text-sm leading-6">
              Three or more distinct insiders at the same issuer buying inside a rolling 14-day window. If five insiders bought across 20 days, the page shows the best 14-day stretch.
            </p>
            <p className="mt-2 text-sm leading-6">
              Ranking is by combined dollar value across the window. A single $5M buy by one CFO does not appear here. Three small $30k director purchases inside two weeks do.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-100">What the data does not say</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
              <li>A cluster is not a buy signal. It is a starting point. Read the 10-Q, check the cap table, look at why insiders chose this moment.</li>
              <li>Insider buying is rare. Most quarters surface a few qualifying tickers, not dozens. Empty result lists are normal.</li>
              <li>EDGAR data lags. Form 4 must be filed within two business days of the transaction, but cron runs daily so the page can be 24 hours behind the wire.</li>
              <li>Ticker mismatches happen. Some Form 4 filings omit the trading symbol or use the issuer CIK only. Those filings are kept in the database but never appear on the home page.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Methodology</h2>
            <p className="mt-2 text-sm leading-6">
              The daily cron pulls the SEC EDGAR Form 4 atom feed in pages of 100. Each filing index points to a primary_doc.xml. The parser walks the nonDerivativeTable, keeps transactions where code = P and acquired-disposed = A then writes them to Neon Postgres with the accession number as the primary key.
            </p>
            <p className="mt-2 text-sm leading-6">
              The home page query groups the last 30 days by ticker, slides a 14-day window over each ticker timeline then keeps the window with the most distinct insiders for that ticker. Clusters with fewer than three distinct insiders are dropped.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Limits</h2>
            <p className="mt-2 text-sm leading-6">
              No auth. No watchlist. No email digest. No history charts. Those are week-two. The point of one-night scope is to ship the honest filter, not the wrapper around it.
            </p>
            <p className="mt-2 text-sm leading-6">
              Not investment advice. Not a brokerage. Not affiliated with the SEC.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
