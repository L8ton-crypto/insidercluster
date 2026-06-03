// SEC EDGAR Form 4 fetcher.
// EFTS full-text search returns hits whose _id is "accession:filename.xml"
// and whose ciks array is [filer_cik, ...possibly_issuer_cik]. The S3 archive
// stores the filing under the filer CIK (accession-number prefix matches).
// We use the filename from _id rather than guessing primary_doc.xml.

const UA = "InsiderCluster research@leightonrice.co.uk";
const SEC_BASE = "https://www.sec.gov";
const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";

export type EftsHit = {
  accession: string;
  filename: string;
  filerCik: string;
};

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

async function fetchSec(url: string, accept = "*/*"): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": accept },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SEC ${url} returned ${res.status}`);
  return res.text();
}


function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagInner(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function valueInside(xml: string): string | null {
  return tagInner(xml, "value");
}

export async function searchFilings(startdt: string, enddt: string, from: number, count: number): Promise<EftsHit[]> {
  const url = `${EFTS_BASE}?q=&forms=4&dateRange=custom&startdt=${startdt}&enddt=${enddt}&from=${from}`;
  const body = await fetchSec(url, "application/json");
  let json: { hits?: { hits?: Array<{ _id?: string; _source?: { ciks?: string[]; adsh?: string } }> } };
  try {
    json = JSON.parse(body);
  } catch {
    return [];
  }
  const hits = json?.hits?.hits || [];
  const out: EftsHit[] = [];
  for (const h of hits.slice(0, count)) {
    const id = h?._id || "";
    const colon = id.indexOf(":");
    if (colon < 0) continue;
    const accession = id.slice(0, colon).trim();
    const filename = id.slice(colon + 1).trim();
    const cikRaw = h?._source?.ciks?.[0] || "";
    const filerCik = cikRaw.replace(/^0+/, "");
    if (!accession || !filename || !filerCik) continue;
    out.push({ accession, filename, filerCik });
  }
  return out;
}

export async function fetchAndParse(hit: EftsHit): Promise<ParsedFiling[]> {
  const accNoDashes = hit.accession.replace(/-/g, "");
  const docUrl = `${SEC_BASE}/Archives/edgar/data/${hit.filerCik}/${accNoDashes}/${hit.filename}`;
  let xml: string;
  try {
    xml = await fetchSec(docUrl);
  } catch {
    return [];
  }

  // The XML might be the ownership document directly, or wrapped in XSL. Try as-is.
  const issuerBlock = tagInner(xml, "issuer") || "";
  const issuer_name_raw0 = tagInner(issuerBlock, "issuerName"); const issuer_name = issuer_name_raw0 ? decodeXmlEntities(issuer_name_raw0) : null;
  const ticker_raw = tagInner(issuerBlock, "issuerTradingSymbol");
  let ticker = ticker_raw ? ticker_raw.toUpperCase().replace(/[^A-Z0-9.\-]/g, "") : null;
  if (ticker && (ticker === "NA" || ticker === "N" || ticker === "NONE" || ticker.length < 1 || ticker.length > 6)) ticker = null;
  const issuer_cik_raw = tagInner(issuerBlock, "issuerCik");
  const issuer_cik = issuer_cik_raw ? issuer_cik_raw.replace(/^0+/, "") : hit.filerCik;

  const ownerBlock = tagInner(xml, "reportingOwner") || "";
  const ownerIdBlock = tagInner(ownerBlock, "reportingOwnerId") || "";
  const insider_name_raw = tagInner(ownerIdBlock, "rptOwnerName");
  const insider_name = insider_name_raw ? decodeXmlEntities(insider_name_raw).toUpperCase() : null;

  const relBlock = tagInner(ownerBlock, "reportingOwnerRelationship") || "";
  const rels: string[] = [];
  const isTrue = (v: string | null) => {
    const t = (v || "").trim().toLowerCase();
    return t === "1" || t === "true";
  };
  if (isTrue(tagInner(relBlock, "isDirector"))) rels.push("Director");
  if (isTrue(tagInner(relBlock, "isOfficer"))) rels.push("Officer");
  if (isTrue(tagInner(relBlock, "isTenPercentOwner"))) rels.push("10% Owner");
  const title = tagInner(relBlock, "officerTitle");
  if (title) rels.push(title);
  const insider_relationship = rels.length ? decodeXmlEntities(rels.join(", ")) : null;

  const filing_url = `${SEC_BASE}/Archives/edgar/data/${hit.filerCik}/${accNoDashes}/${hit.accession}-index.htm`;

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

    if (transaction_code !== "P") continue;
    if (ad && ad !== "A") continue;
    if (!shares || !price_per_share || !total_value) continue;

    out.push({
      filing_id: `${hit.accession}-${i++}`,
      ticker,
      issuer_name,
      cik: issuer_cik,
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
