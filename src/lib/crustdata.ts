// Crustdata REST client (API version 2025-11-01). The only paid data source.
// Verified against docs.crustdata.com/openapi-specs/2025-11-01/introduction:
//   base https://api.crustdata.com, header "authorization: Bearer <key>", header "x-api-version: 2025-11-01".
// Endpoints used (all on the standard plan): /company/search, /company/enrich, /person/search, /person/enrich,
// /web/search/live, /account/credits. Credits are only charged when a call returns data.
export const CRUSTDATA_BASE = process.env.CRUSTDATA_BASE_URL || "https://api.crustdata.com";
const VERSION = "2025-11-01";

export function hasCrustdata() { return !!process.env.CRUSTDATA_API_KEY; }
export function dataSource() { return hasCrustdata() ? "crustdata" : "manual"; }

/** One trace entry per API call, so every agent decision can show what it looked at. */
export type Call = { name: string; input: any; ms: number; ok: boolean; credits?: number };
export class Trace {
  calls: Call[] = [];
  urls = new Set<string>();
  get toolCalls() { return this.calls.map((c) => ({ name: c.name, input: c.input })); }
  get credits() { return this.calls.reduce((s, c) => s + (c.credits || 0), 0); }
}

function friendly(status: number, body: string) {
  const msg = (() => { try { const j = JSON.parse(body); return j?.error?.message || j?.description || j?.reason || j?.error || body; } catch { return body; } })();
  const m = String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 300);
  if (status === 401) return `Crustdata rejected the API key. Check CRUSTDATA_API_KEY in Vercel. (${m})`;
  if (status === 403 && /credit/i.test(m)) return `Crustdata: out of credits. Top up at crustdata.com. (${m})`;
  if (status === 403) return `Crustdata: this endpoint or field is not on your plan. (${m})`;
  if (status === 429) return `Crustdata rate limit reached. Wait a minute and try again. (${m})`;
  return `Crustdata ${status}: ${m}`;
}

/** POST (or GET when body is null) with a hard timeout and one retry on 429/5xx. */
export async function cd<T = any>(path: string, body: any, trace?: Trace, ms = 45000): Promise<T> {
  const key = process.env.CRUSTDATA_API_KEY;
  if (!key) throw new Error("CRUSTDATA_API_KEY is not set (Vercel > Project > Settings > Environment Variables).");
  const t0 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(CRUSTDATA_BASE + path, {
        method: body === null ? "GET" : "POST",
        headers: { authorization: `Bearer ${key}`, "x-api-version": VERSION, "content-type": "application/json", accept: "application/json" },
        body: body === null ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(ms),
      });
    } catch (e: any) {
      trace?.calls.push({ name: "crustdata " + path, input: body, ms: Date.now() - t0, ok: false });
      throw new Error(/abort|timeout/i.test(String(e?.name) + e?.message) ? `Crustdata ${path} took too long. Try again.` : `Crustdata ${path}: ${e?.message || e}`);
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt === 0) { await new Promise((r) => setTimeout(r, 2500)); continue; }
    const credits = Number(res.headers?.get?.("x-credits-used") || 0) || undefined;
    trace?.calls.push({ name: "crustdata " + path, input: body, ms: Date.now() - t0, ok: res.ok, credits });
    // "No data" is a normal answer for search and enrich, not a failure.
    if (res.status === 404) return (path.includes("search") ? { companies: [], profiles: [], results: [] } : []) as any;
    if (!res.ok) throw new Error(friendly(res.status, text));
    try { return JSON.parse(text) as T; } catch { throw new Error(`Crustdata ${path}: response was not JSON`); }
  }
  throw new Error(`Crustdata ${path}: no response`);
}

// ---------------- Companies ----------------
export type Filter = { field: string; type: string; value: any } | { op: "and" | "or"; conditions: Filter[] };

/** Fields returned by /company/search for discovery (search uses 1m/3m/6m/12m growth keys). */
export const SEARCH_FIELDS = [
  "crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "basic_info.website", "basic_info.description",
  "headcount.total", "headcount.growth_percent", "funding.last_fundraise_date", "funding.last_round_type",
  "funding.last_round_amount_usd", "funding.total_investment_usd", "taxonomy.professional_network_industry",
];

export async function searchCompanies(filters: Filter, limit: number, trace?: Trace, sorts?: { field: string; order: "asc" | "desc" }[]) {
  const r = await cd<{ companies?: any[]; next_cursor?: string; total_count?: number }>("/company/search",
    { filters, limit: Math.max(1, Math.min(100, limit)), fields: SEARCH_FIELDS, ...(sorts ? { sorts } : {}) }, trace);
  return { companies: r.companies || [], total: r.total_count ?? (r.companies || []).length };
}

/** Field groups for scoring. Never request "people": it returns ~300 profiles (megabytes) per company. */
export const ENRICH_GROUPS = ["basic_info", "headcount", "funding", "hiring", "news", "followers", "taxonomy"];

export async function enrichCompany(id: { crustdata_company_id?: number; domain?: string; name?: string }, trace?: Trace): Promise<any | null> {
  const body: any = { fields: ENRICH_GROUPS };
  if (id.crustdata_company_id) body.crustdata_company_ids = [Number(id.crustdata_company_id)];
  else if (id.domain) body.domains = [id.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]];
  else if (id.name) { body.names = [id.name]; body.exact_match = true; }
  else return null;
  const r = await cd<any[]>("/company/enrich", body, trace, 60000);
  const m = (Array.isArray(r) ? r : [])[0]?.matches || [];
  const best = m.sort((a: any, b: any) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
  if (!best || (best.confidence_score ?? 1) < 0.6) return null;
  const c = best.company_data || null;
  if (c) slimCompany(c);
  return c;
}

/** Drop the heavy time series we never read, so a company record stays small in the database and logs. */
function slimCompany(c: any) {
  if (c.headcount) for (const k of Object.keys(c.headcount)) if (/timeseries|^by_/.test(k)) delete c.headcount[k];
  if (c.followers) delete c.followers.timeseries;
  if (c.hiring) { delete c.hiring.open_jobs_timeseries; for (const k of Object.keys(c.hiring)) if (/^by_function/.test(k)) delete c.hiring[k]; }
  if (c.funding) { delete c.funding.investors_detailed; if (Array.isArray(c.funding.milestones)) c.funding.milestones = c.funding.milestones.slice(0, 6).map((m: any) => ({ round_type: m.round_type, date: m.date || m.funding_date, amount_usd: m.amount_usd, lead_investors: m.lead_investors })); }
  if (Array.isArray(c.news)) c.news = c.news.slice(0, 40).map((n: any) => ({ title: n.article_title, url: n.article_url, date: n.article_publish_date, publisher: n.article_publisher_name }));
}

// ---------------- People ----------------
export const PEOPLE_FIELDS = [
  "basic_profile.name", "basic_profile.headline", "basic_profile.location",
  "experience.employment_details.current.title", "experience.employment_details.current.name",
  "experience.employment_details.current.seniority_level", "experience.employment_details.current.start_date",
  "experience.employment_details.current.crustdata_company_id", "experience.employment_details.current.company_website",
  "education.schools.school", "social_handles.professional_network_identifier.profile_url", "contact",
];

/** People at one company whose current title contains any of the words. Search matches all words of each phrase, any order. */
export async function searchPeople(companyId: number | null, companyName: string, titleWords: string[], limit: number, trace?: Trace) {
  const employer: Filter = companyId
    ? { field: "experience.employment_details.current.company_id", type: "=", value: Number(companyId) }
    : { field: "experience.employment_details.current.company_name", type: "[.]", value: companyName };
  const filters: Filter = {
    op: "and", conditions: [
      employer,
      { op: "or", conditions: titleWords.map((w) => ({ field: "experience.employment_details.current.title", type: "(.)", value: w })) },
      { field: "experience.employment_details.current.seniority_level", type: "in", value: ["CXO", "Vice President", "Director", "Experienced Manager", "Entry Level Manager", "Senior"] },
    ],
  };
  const r = await cd<{ profiles?: any[] }>("/person/search", { filters, limit, fields: PEOPLE_FIELDS }, trace);
  return r.profiles || [];
}

/** Business emails through /person/enrich (contact.business_emails, +1 credit each). Up to 25 URLs per call. */
export async function businessEmails(profileUrls: string[], trace?: Trace): Promise<Record<string, { email: string; status: string; company_id?: number }[]>> {
  const urls = profileUrls.filter(Boolean).slice(0, 25);
  if (!urls.length) return {};
  const r = await cd<any[]>("/person/enrich", { professional_network_profile_urls: urls, fields: ["basic_profile.name", "contact.business_emails"] }, trace);
  const out: Record<string, any[]> = {};
  for (const row of Array.isArray(r) ? r : []) {
    const pd = row?.matches?.[0]?.person_data;
    const list = (pd?.contact?.business_emails || []).map((e: any) => ({ email: String(e.email || ""), status: String(e.status || "unknown"), company_id: e.crustdata_company_id }));
    out[normUrl(row.matched_on)] = list;
  }
  return out;
}
export const normUrl = (u: string) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

// ---------------- Web ----------------
export type WebHit = { url: string; title: string; snippet: string; date?: string };
export async function webSearch(query: string, trace?: Trace, sources = ["web"]): Promise<WebHit[]> {
  const r = await cd<any>("/web/search/live", { query, location: "IN", sources }, trace, 40000);
  const hits: WebHit[] = [];
  for (const x of r?.results || []) {
    const url = x.url || x.link || x.article_url;
    if (!url) continue;
    hits.push({ url, title: String(x.title || x.article_title || ""), snippet: String(x.snippet || x.description || x.content || "").slice(0, 600), date: x.date || x.published_date || undefined });
    trace?.urls.add(url);
  }
  return hits;
}

export async function credits(): Promise<number | null> {
  const r = await cd<any>("/account/credits", null);
  return r?.account?.credits ?? r?.credits ?? null;
}

/** Resolve brand names an organiser typed to real companies. /company/identify is free. */
export async function identifyCompanies(names: string[], trace?: Trace): Promise<{ query: string; id: number; name: string; domain: string; description: string; headcount_range: string }[]> {
  const list = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 25);
  if (!list.length) return [];
  const r = await cd<any[]>("/company/identify", { names: list }, trace);
  const out: { query: string; id: number; name: string; domain: string; description: string; headcount_range: string }[] = [];
  for (const row of Array.isArray(r) ? r : []) {
    const best = (row?.matches || []).sort((a: any, b: any) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
    const b = best?.company_data?.basic_info;
    if (!b || (best.confidence_score ?? 0) < 0.5) continue;
    out.push({ query: String(row.matched_on || ""), id: Number(best.company_data.crustdata_company_id || b.crustdata_company_id), name: String(b.name || row.matched_on), domain: String(b.primary_domain || "").toLowerCase(), description: String(b.description || "").slice(0, 400), headcount_range: String(b.employee_count_range || "") });
  }
  return out;
}
