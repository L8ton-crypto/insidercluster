// SEC EDGAR Form 4 fetcher. Atom feed -> primary_doc.xml parser.
// SEC requires a User-Agent header identifying the requester.

const UA = "InsiderCluster research@leightonrice.co.uk";
const SEC_BASE = "https://www.sec.gov";

export type ParsedFiling = {
  filing_id: string;
  ticker: string | null;
  issuer_name: string | null;
  cik: string;
  insider_name: string | null;
  insider_relationship: string | null;
  transaction_date: string | null;
  transaction_code: string | null;
  shares: number | null;
  price_per_share: number | null;
  total_value: number | null;
  filing_url: string;
};

// SEC fair-access: throttle requests to <= 10/sec. We use ~5/sec.
async function fetchSec(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "*/*" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SEC ${url} returned ${res.status}`);
  return res.text();
}

function tagInner(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function valueInside(xml: string): string | null {
  const v = tagInner(xml, "value");
  return v;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Pull recent Form 4 filings via Atom feed. start = offset, count <= 100.
export async function fetchAtom(start: number, count: number): Promise<Array<{ accession: string; cik: string; indexUrl: string }>> {
  const url = `${SEC_BASE}/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=include&count=${count}&start=${start}&output=atom`;
  const xml = await fetchSec(url);
  const entries: Array<{ accession: string; cik: string; indexUrl: string }> = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const entry = m[1];
    const idTxt = tagInner(entry, "id") || "";
    const accMatch = idTxt.match(/accession-number=([\d-]+)/);
    const accession = accMatch ? accMatch[1] : "";
    const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/i);
    const linkHref = linkMatch ? decodeEntities(linkMatch[1]) : "";
    const cikMatch = linkHref.match(/CIK=(\d+)/i);
    const cik = cikMatch ? cikMatch[1].replace(/^0+/, "") : "";
    if (!accession || !cik) continue;
    const accNoDashes = accession.replace(/-/g, "");
    const indexUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accNoDashes}/${accession}-index.htm`;
    entries.push({ accession, cik, indexUrl });
  }
  return entries;
}

// Fetch primary_doc.xml for a filing and parse out code-P non-derivative transactions.
// Returns one ParsedFiling per transaction (a filing can have multiple).
export async function fetchAndParse(accession: string, cik: string): Promise<ParsedFiling[]> {
  const accNoDashes = accession.replace(/-/g, "");
  const docUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accNoDashes}/primary_doc.xml`;
  let xml: string;
  try {
    xml = await fetchSec(docUrl);
  } catch {
    return [];
  }

  const issuerBlock = tagInner(xml, "issuer") || "";
  const issuer_name = tagInner(issuerBlock, "issuerName");
  const ticker_raw = tagInner(issuerBlock, "issuerTradingSymbol");
  const ticker = ticker_raw ? ticker_raw.toUpperCase().replace(/[^A-Z0-9.\-]/g, "") : null;

  const ownerBlock = tagInner(xml, "reportingOwner") || "";
  const ownerIdBlock = tagInner(ownerBlock, "reportingOwnerId") || "";
  const insider_name_raw = tagInner(ownerIdBlock, "rptOwnerName");
  const insider_name = insider_name_raw ? insider_name_raw.toUpperCase() : null;

  const relBlock = tagInner(ownerBlock, "reportingOwnerRelationship") || "";
  const rels: string[] = [];
  if ((tagInner(relBlock, "isDirector") || "").trim() === "1" || (tagInner(relBlock, "isDirector") || "").trim().toLowerCase() === "true") rels.push("Director");
  if ((tagInner(relBlock, "isOfficer") || "").trim() === "1" || (tagInner(relBlock, "isOfficer") || "").trim().toLowerCase() === "true") rels.push("Officer");
  if ((tagInner(relBlock, "isTenPercentOwner") || "").trim() === "1" || (tagInner(relBlock, "isTenPercentOwner") || "").trim().toLowerCase() === "true") rels.push("10% Owner");
  const title = tagInner(relBlock, "officerTitle");
  if (title) rels.push(title);
  const insider_relationship = rels.length ? rels.join(", ") : null;

  const filing_url = `${SEC_BASE}/Archives/edgar/data/${cik}/${accNoDashes}/${accession}-index.htm`;

  const ndTable = tagInner(xml, "nonDerivativeTable") || "";
  const txRe = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g;
  const out: ParsedFiling[] = [];
  let i = 0;
  let m;
  while ((m = txRe.exec(ndTable)) !== null) {
    const tx = m[1];
    const dateBlock = tagInner(tx, "transactionDate") || "";
    const transaction_date = valueInside(dateBlock);

    const codingBlock = tagInner(tx, "transactionCoding") || "";
    const transaction_code = tagInner(codingBlock, "transactionCode");

    const amountsBlock = tagInner(tx, "transactionAmounts") || "";
    const sharesBlock = tagInner(amountsBlock, "transactionShares") || "";
    const priceBlock = tagInner(amountsBlock, "transactionPricePerShare") || "";
    const adBlock = tagInner(amountsBlock, "transactionAcquiredDisposedCode") || "";
    const ad = valueInside(adBlock);

    const shares_s = valueInside(sharesBlock);
    const price_s = valueInside(priceBlock);
    const shares = shares_s ? Number(shares_s) : null;
    const price_per_share = price_s ? Number(price_s) : null;
    const total_value = shares !== null && price_per_share !== null ? Math.round(shares * price_per_share * 100) / 100 : null;

    // Only keep open-market purchases: code P with acquired side A.
    if (transaction_code !== "P") continue;
    if (ad && ad !== "A") continue;

    out.push({
      filing_id: `${accession}-${i++}`,
      ticker,
      issuer_name,
      cik,
      insider_name,
      insider_relationship,
      transaction_date,
      transaction_code,
      shares,
      price_per_share,
      total_value,
      filing_url,
    });
  }
  return out;
}
