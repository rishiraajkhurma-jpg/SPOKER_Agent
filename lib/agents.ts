// SponsorDesk agents A0-A7 without any AI model. Data comes from Crustdata; decisions are explicit rules;
// writing is templates that pass the email linter. Every score shows its factors and every fact its source.
// Works for any event: college fests, conferences, hackathons, meetups, sports and cultural events.
import { fixDashes } from "./lint";
import { verifySources, type CheckedSource } from "./verify";
import * as CD from "./crustdata";
import { scoreContact, sponsorKind } from "./contacts";

export type Source = { url: string; title?: string; supports?: string; verified?: boolean; how?: string };
/** Same shape the flows used to get from the model layer: what was called and what was read. */
export type RawResult = { text: string; toolCalls: { name: string; input: any }[]; sources: Source[]; seen: string[]; credits?: number };

export type Tier = { name: string; price_inr: number; deliverables: string };
export type EventProfile = {
  name: string; organizer: string; dates: string; city: string; website?: string; one_line?: string;
  audience: string; proof?: string; proof_items?: { claim: string; url: string; verified: boolean }[]; unverified_sources?: Source[]; tiers: Tier[]; floor_inr: number; goal_inr?: number; floor_locked?: boolean;
  inkind_needs?: string; models?: string[]; policies?: string; past_sponsors?: string; sources?: Source[];
  sender: { name: string; title: string; org: string; phone?: string; email?: string };
  postal_address: string;
  event_type?: EventType; reach?: number; audience_short?: string; pricing_basis?: string;
};

export const MODELS = ["cash_tier", "property_naming", "brand_integration", "activation", "hiring", "case_competition", "workshop", "performance_linked", "csr", "product_inkind", "services_credits", "opportunity", "logistics", "media", "offer_codes", "hybrid", "revenue_share", "dealer_coop", "prize_pool"];

// ---------------- small helpers ----------------
const lakh = (n: number) => {
  n = Math.round(Number(n) || 0);
  if (n >= 1e7) return `INR ${+(n / 1e7).toFixed(2)} crore`;
  if (n >= 1e5) return `INR ${+(n / 1e5).toFixed(2)} lakh`;
  return `INR ${n.toLocaleString("en-IN")}`;
};
export const inrText = lakh;
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const daysAgo = (d?: string | null) => { const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? Infinity : (Date.now() - t) / 86400e3; };
const monthYear = (d?: string | null) => { const t = d ? new Date(d) : null; return t && !isNaN(t.getTime()) ? t.toLocaleString("en-IN", { month: "long", year: "numeric" }) : ""; };
const first = (n?: string) => (n || "there").trim().split(/\s+/)[0];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cleanDomain = (d?: string) => String(d || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
const sentenceCase = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s;
const plusDays = (n: number) => { const d = new Date(Date.now() + n * 86400e3); return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }); };

export function signature(e: EventProfile) {
  const s = e.sender || ({} as any);
  return ["Best regards,", s.name, s.title, s.org, [s.phone, s.email].filter(Boolean).join(" | "), e.website, e.postal_address].filter(Boolean).join("\n");
}
/** Guarantee a greeting and paragraph breaks. */
export function tidyBody(body: string, firstName = "") {
  let b = (body || "").replace(/\r/g, "").trim();
  if (!b) return b;
  if (!/^(hi|hello|dear)\b/i.test(b)) b = `Hi ${firstName || "there"},\n\n` + b;
  return b;
}
export function withSignature(body: string, e: EventProfile) {
  return fixDashes(body.trim()) + "\n\n" + signature(e);
}

// ---------------- event understanding ----------------
export type EventType = "entrepreneurship" | "tech" | "cultural" | "management" | "sports" | "conference" | "community" | "college";
const TYPE_RULES: [EventType, RegExp][] = [
  ["entrepreneurship", /e-?summit|entrepreneur|startup|e-?cell|founder|pitch|venture|incubat/i],
  ["tech", /tech ?fest|techfest|hackathon|hack\b|coding|developer|robotic|engineering fest|ai summit|devfest|technical/i],
  ["management", /management|business school|b-?school|case competition|\bmba\b|marketing summit|finance summit|consult/i],
  ["sports", /sport|athlet|marathon|cricket|football|tournament|league|esports|e-sports/i],
  ["cultural", /cultural|culfest|music|dance|literary|lit fest|film|theatre|theater|fashion|comedy|art fest|carnival/i],
  ["conference", /conference|summit|expo|forum|conclave|symposium/i],
  ["community", /meetup|community|club|society|chapter/i],
];
export function eventType(text: string): EventType {
  for (const [t, rx] of TYPE_RULES) if (rx.test(text)) return t;
  return /college|university|institute|fest|campus|school|\b(iit|iim|nit|bits|iiit|iisc)\b/i.test(text) ? "college" : "conference";
}
const AUDIENCE: Record<EventType, { who: string; short: string; age: string }> = {
  entrepreneurship: { who: "college students, early-stage founders, investors and startup mentors", short: "students and early-stage founders", age: "18 to 30" },
  tech: { who: "engineering and science students, developers and student builders", short: "student developers and engineers", age: "18 to 26" },
  management: { who: "management students and early-career professionals", short: "management students and young professionals", age: "21 to 30" },
  sports: { who: "college athletes, students and sports fans", short: "students and young sports fans", age: "17 to 26" },
  cultural: { who: "college students and young audiences from across the region", short: "college students and young audiences", age: "17 to 25" },
  conference: { who: "professionals, decision makers and practitioners in the event's field", short: "professionals and decision makers", age: "24 to 50" },
  community: { who: "community members, practitioners and enthusiasts", short: "an engaged practitioner community", age: "20 to 40" },
  college: { who: "college students", short: "college students", age: "17 to 25" },
};
const INKIND: Record<EventType, string> = {
  entrepreneurship: "prizes for winning startups, cloud and software credits, mentor time, food and beverage, venue branding, travel for speakers",
  tech: "cloud and API credits, hardware for hackers, prizes, food and beverage, swag, internships for winners",
  management: "prizes and internships for case winners, food and beverage, printing, merchandise",
  sports: "kits and equipment, energy drinks and water, medical support, prizes, travel for teams",
  cultural: "food and beverage, sound and lights, artist hospitality, prizes, merchandise, printing",
  conference: "venue, food and beverage, AV production, printing, speaker travel, attendee kits",
  community: "venue, food and beverage, software credits, swag, speaker travel",
  college: "food and beverage, prizes, printing, merchandise, travel",
};
const TYPE_PRICE: Record<EventType, number> = { entrepreneurship: 1.2, tech: 1.1, management: 1.1, conference: 1.4, cultural: 1.0, college: 0.9, community: 0.8, sports: 0.8 };
function lev(a: string, b: string) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const BIG_INSTITUTE = /\b(iit|iim|iisc|bits|nit|iiit|isb|xlri|nlu|aiims|iiser|university of|national institute)\b/i;
const CITIES = ["Mumbai", "Bombay", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Chandigarh", "Indore", "Bhopal", "Nagpur", "Surat", "Kochi", "Coimbatore", "Guwahati", "Bhubaneswar", "Patna", "Noida", "Gurugram", "Gurgaon", "Goa", "Mysuru", "Vellore", "Manipal", "Roorkee", "Kharagpur", "Varanasi", "Dehradun", "Visakhapatnam", "Vijayawada", "Thiruvananthapuram", "Madurai", "Tiruchirappalli", "Trichy", "Ranchi", "Raipur", "Amritsar", "Ludhiana", "Jodhpur", "Udaipur", "Pilani", "Powai", "Singapore", "Dubai", "London"];

/** Pull numbers like "20,000+ footfall", "1.2 lakh visitors", "5k registrations". */
function parseCounts(text: string): { n: number; what: string; raw: string }[] {
  const out: { n: number; what: string; raw: string }[] = [];
  const rx = /(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lac|l|crore|million|mn)?\s*\+?\s*(footfall|attendees|participants|registrations|visitors|students|delegates|people|startups|teams|colleges|speakers|hackers|sports|events|competitions|athletes|runners)\b/gi;
  for (const m of text.matchAll(rx)) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    const u = (m[2] || "").toLowerCase();
    if (u === "k") n *= 1e3; else if (/^(lakh|lac|l)$/.test(u)) n *= 1e5; else if (u === "crore") n *= 1e7; else if (/^(million|mn)$/.test(u)) n *= 1e6;
    if (n > 0 && n < 5e7) out.push({ n: Math.round(n), what: m[3].toLowerCase(), raw: m[0].trim() });
  }
  const rx2 = /(footfall|attendance|audience|registrations?)\s*(of|:|over|around|about)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lac|crore|million)?/gi;
  for (const m of text.matchAll(rx2)) {
    let n = parseFloat(m[3].replace(/,/g, "")); const u = (m[4] || "").toLowerCase();
    if (u === "k") n *= 1e3; else if (/lakh|lac/.test(u)) n *= 1e5; else if (u === "crore") n *= 1e7; else if (u === "million") n *= 1e6;
    if (n >= 50 && n < 5e7) out.push({ n: Math.round(n), what: m[1].toLowerCase().replace(/s$/, "") === "registration" ? "registrations" : "footfall", raw: m[0].trim() });
  }
  return out;
}
/** Amounts in rupees: "40 lakh", "INR 3,00,000", "Rs 75k", "1.5L", "2 crore". */
export function parseInr(text: string): number[] {
  const out: number[] = [];
  const rx = /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l|crores?|cr)?\b|(\d[\d,]*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l|crores?|cr)\b/gi;
  for (const m of text.matchAll(rx)) {
    let n = parseFloat((m[1] || m[3]).replace(/,/g, ""));
    const u = (m[2] || m[4] || "").toLowerCase();
    if (u === "k") n *= 1e3; else if (/^(lakhs?|lacs?|l)$/.test(u)) n *= 1e5; else if (/^(crores?|cr)$/.test(u)) n *= 1e7;
    if (!m[1] && !u) continue;
    if (n >= 1000) out.push(Math.round(n));
  }
  return out;
}

// ---------- A0: build the event brief from what the organiser typed (plus one optional web search) ----------
export type BriefResult =
  | { status: "ok"; profile: EventProfile; searches: number; verified: number }
  | { status: "clarify"; questions: string[]; found: string; sources: CheckedSource[]; searches: number };

export async function buildBrief(oneLine: string, sender: { name: string; title?: string; phone?: string; email?: string }, answers = ""): Promise<BriefResult> {
  const text = `${oneLine}\n${answers}`.trim();
  const parts = oneLine.split(/[,|;\n]/).map((s) => s.trim()).filter(Boolean);
  // "Aavhan 2027 IIT Bombay" in one chunk: the event is before the year, the organiser after it.
  const ORG = /institute|college|university|school|\b(iit|iim|nit|bits|iiit|iisc)\b|e-?cell|club|society|foundation|association|council|chapter|community|\bpvt\b|\bltd\b|\bllp\b|\binc\b/i;
  const split0 = (parts[0] || "").match(/^(.*?\b20\d{2})\s+(.+)$/) || (parts[0] || "").match(/^(.*?)\s+((?:by\s+)?(?:IIT|IIM|NIT|BITS|IIIT|IISc)\b.*)$/i);
  if (split0 && ORG.test(split0[2])) parts.splice(0, 1, split0[1].trim(), split0[2].trim());
  let name = parts[0] || "";
  const years = text.match(/\b20\d{2}\b/g) || [];
  const MONTH = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;
  const datePart = parts.slice(1).find((p) => MONTH.test(p) || /\b20\d{2}\b/.test(p) && !/goal|budget|₹|inr|lakh/i.test(p)) || "";
  const orgPart = parts.slice(1).find((p) => (ORG.test(p) || /^by /i.test(p)) && p !== datePart) || "";
  const cityRaw = CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text)) || "";
  const cityHit = ({ Bombay: "Mumbai", Powai: "Mumbai", Bangalore: "Bengaluru", Gurgaon: "Gurugram", Trichy: "Tiruchirappalli" } as Record<string, string>)[cityRaw] || cityRaw;
  const goal = (() => { const g = text.match(/(goal|target|raise|budget)[^\n,;]*/i); return g ? parseInr(g[0])[0] || 0 : 0; })();
  const pin = text.match(/\b\d{6}\b/)?.[0] || "";
  const addrLine = (() => { const l = answers.split(/\n/).find((x) => /\b\d{6}\b/.test(x)) || ""; const m = l.match(/(?:postal address|address)\s*:\s*(.+)$/i); return (m ? m[1] : l.split(/(?<=[.!?])\s+/).find((x) => /\b\d{6}\b/.test(x)) || l).trim().replace(/\.$/, ""); })();
  const urlIn = text.match(/https?:\/\/[^\s,]+/)?.[0] || "";

  // Typo-tolerant: "Avhaan" matches "Aavhan" (edit distance 2 for long words, 1 for short ones).
  const near = (w: string, tok: string) => tok === w || (w.length >= 4 && Math.abs(tok.length - w.length) <= 2 && lev(w, tok) <= (w.length >= 6 ? 2 : 1));
  // The organiser's answers fix the spelling before we search ("It is Aavhan").
  for (const w of name.split(/\s+/)) {
    const fix = answers.split(/[^A-Za-z0-9]+/).find((t) => t.length >= 4 && t.toLowerCase() !== w.toLowerCase() && near(w.toLowerCase(), t.toLowerCase()));
    if (fix && /^[a-z]/i.test(w) && !/^20\d\d$/.test(w)) name = name.replace(w, fix);
  }
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^20\d\d$/.test(w));
  const tokens = (h: CD.WebHit) => `${h.title} ${h.snippet} ${h.url}`.toLowerCase().split(/[^a-z0-9]+/);
  const isRel = (h: CD.WebHit) => words.length > 0 && words.every((w) => tokens(h).some((t) => near(w, t)));
  // Web check: event name + organiser (1 credit), and once more without the year if nothing relevant came back.
  const trace = new CD.Trace();
  let hits: CD.WebHit[] = [];
  if (CD.hasCrustdata() && name) {
    const org0 = orgPart || (parts.slice(1).find((p) => ORG.test(p)) || "");
    const queries = [`${name} ${org0}`.trim(), `${name.replace(/\b20\d{2}\b/, "").trim()} ${org0}`.trim()];
    for (const q of [...new Set(queries)]) {
      try { hits = hits.concat(await CD.webSearch(q.slice(0, 300), trace)); } catch { /* keep what we have */ }
      if (hits.some(isRel)) break;
    }
  }
  const relevant = hits.filter(isRel).filter((h, i, all) => all.findIndex((x) => x.url === h.url) === i).slice(0, 8);
  // Use the spelling the event's own pages use.
  for (const w of words) {
    const seen: Record<string, number> = {};
    for (const h of relevant) for (const t of new Set(`${h.title} ${h.snippet}`.split(/[^A-Za-z0-9]+/))) if (t.toLowerCase() !== w && near(w, t.toLowerCase())) seen[t] = (seen[t] || 0) + 1;
    const best = Object.entries(seen).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) name = name.replace(new RegExp(`\\b${w}\\b`, "i"), best[0][0].toUpperCase() + best[0].slice(1));
  }
  const corpus = [text, ...relevant.map((h) => `${h.title}. ${h.snippet}`)].join("\n");

  if (!name || (!relevant.length && !answers.trim() && !parseCounts(text).length)) {
    const checked = await verifySources(relevant, [...trace.urls], 6);
    return {
      status: "clarify", searches: trace.calls.length, sources: checked.filter((c) => c.verified),
      found: name ? (hits.length ? `Found ${hits.length} pages, but none clearly about "${name}".` : `Nothing on the web clearly describes "${name}" yet.`) : "The line did not include an event name.",
      questions: [orgPart ? `What kind of event is it (sports, cultural, technical, entrepreneurship, conference), and is "${name}" spelled the way the event spells it?` : "Who organises it (institute, club, company or community)?", "When and where is it (dates and city)?", "Roughly how many people attend, and who are they? Add the postal address with PIN for the email footer."],
    };
  }

  const type = eventType(`${name} ${oneLine} ${answers} ${relevant.map((h) => h.title).join(" ")}`);
  const counts = parseCounts(corpus);
  const reachC = counts.filter((c) => /footfall|attendee|visitor|people|participant|delegate|registration|student|athlete|runner/.test(c.what)).sort((a, b) => b.n - a.n)[0];
  const typedReach = parseCounts(text).filter((c) => /footfall|attendee|visitor|people|participant|delegate|registration|student|athlete|runner/.test(c.what))[0];
  const reach = (typedReach || reachC)?.n || 0;
  const big = BIG_INSTITUTE.test(corpus);
  const R = reach || (type === "conference" ? 800 : big ? 12000 : 3000);
  const instMult = big ? 1.0 : 0.65;
  // Pricing rule: about INR 40 per attendee for the title tier, scaled by event type and the organiser's pull.
  const reachTitle = clamp(roundTo(R * 40 * TYPE_PRICE[type] * instMult, 50000), 150000, 7500000);
  // With a goal, size the ladder so a realistic mix (1 Title, 2 Platinum, 4 Gold, 6 Silver = 3.6 x Title) reaches it.
  const title = goal ? clamp(roundTo(goal / 3.6, 50000), 100000, 20000000) : reachTitle;
  const tiers: Tier[] = [
    { name: "Title", price_inr: title, deliverables: `"<Sponsor> presents" naming, main stage branding, 2 sessions or activations, logo on all media, 8 social posts, booth, post-event report` },
    { name: "Platinum", price_inr: roundTo(title * 0.5, 10000), deliverables: "Stage branding, 1 session or workshop, booth, logo on media, 5 social posts, post-event report" },
    { name: "Gold", price_inr: roundTo(title * 0.25, 10000), deliverables: "Booth or activation zone, logo on website and posters, 3 social posts, report" },
    { name: "Silver", price_inr: roundTo(title * 0.1, 5000), deliverables: "Logo on website and posters, 1 social post, product or flyer in attendee kits" },
  ];
  const floor = roundTo(tiers[3].price_inr * 0.8, 5000);

  const proof = relevant.flatMap((h) => {
    const t = `${h.title}. ${h.snippet}`; const yr = t.match(/\b(20\d{2})\b/)?.[1];
    const prize = t.match(/(?:cash )?prize(?: pool| money)?[^.]{0,40}?(?:inr|rs\.?|₹)\s*[\d.,]+\s*\+?\s*(?:lakh|lac|crore|k)?\+?/i)?.[0];
    return [...parseCounts(t).map((c) => ({ claim: yr ? `${c.raw} (${yr})` : c.raw, url: h.url })), ...(prize ? [{ claim: `${prize.trim()}${yr ? ` (${yr})` : ""}`, url: h.url }] : [])];
  }).slice(0, 6);
  const spons = (() => {
    const found: string[] = [];
    for (const h of relevant) {
      const t = `${h.title}. ${h.snippet}`;
      for (const m of t.matchAll(/(?:proud to have|welcome|welcoming|thank(?:s| you) to|presenting|announcing|introducing)\s+((?:[A-Z][\w&.'-]*\s?){1,4})\s+as\s+(?:the|our)\s+((?:[A-Z][a-z]+\s?){0,3}(?:Partner|Sponsor))/g)) found.push(`${m[1].trim()} (${m[2].trim()}${t.match(/\b(20\d{2})\b/) ? `, ${t.match(/\b(20\d{2})\b/)![1]}` : ""})`);
      for (const m of t.matchAll(/(?:sponsored by|powered by|in association with|title sponsor|associate sponsor)\s*:?\s*((?:[A-Z][\w&.'-]*\s?){1,4})/g)) found.push(m[1].trim());
    }
    if (found.length) return [...new Set(found)].slice(0, 8).join("; ") + " (from the event's own posts in web results)";
    for (const h of relevant) {
      const m = `${h.title}. ${h.snippet}`.match(/(?:sponsors?|partners?|sponsored by|partnered with)(?: include| like| such as| were| are|:)?\s+((?:[A-Z][\w&.'-]*(?:\s[A-Z][\w&.'-]*)?)(?:,\s*(?:and\s+)?[A-Z][\w&.'-]*(?:\s[A-Z][\w&.'-]*)?){1,8})/);
      if (m) return `${m[1]} (${host(h.url)})`;
    }
    return "";
  })();
  const snipSite = relevant.map((h) => (`${h.title} ${h.snippet}`.match(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|in|org|co\.in|ac\.in|net|io|fest|events?))\b/i) || [])[1]).find((d) => d && words.some((w) => near(w, d.split(".")[0].toLowerCase()) || d.toLowerCase().includes(w)));
  const site = urlIn || (snipSite ? `https://www.${snipSite}` : "") || relevant.find((h) => /\.(ac\.in|edu|org|in)\b|\bfest|summit/i.test(host(h.url)) || words.some((w) => host(h.url).includes(w)))?.url || "";
  const checked = await verifySources([...relevant.map((h) => ({ url: h.url, title: h.title, supports: h.snippet.slice(0, 160) })), ...proof.map((p) => ({ url: p.url, title: p.claim }))], [...trace.urls], 12);
  const good = checked.filter((c) => c.verified);
  const ok = (u: string) => good.some((g) => g.url === u.replace(/\/$/, "") || g.url === u);
  const proofItems = proof.map((p) => ({ claim: p.claim, url: p.url, verified: ok(p.url) }));
  const A = AUDIENCE[type];
  const sizeText = reach ? `${reach.toLocaleString("en-IN")} ${typedReach ? "expected (organiser's figure)" : `(${reachC?.raw}, ${host(relevant.find((h) => (h.title + h.snippet).includes(reachC?.raw || "~"))?.url || "web")})`}` : "size not stated yet: add footfall in Edit details";
  const caseFrom = (x: string) => { if (!x) return x; const src = [answers, ...relevant.map((h) => h.title + " " + h.snippet)].join(" "); const m = src.match(new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")); return m && m[0] !== x && /[A-Z]/.test(m[0]) ? m[0] : x; };
  const organizer = caseFrom(orgPart.replace(/^by\s+/i, "")) || (answers.match(/(?:organi[sz]ed by|organi[sz]er\s*:)\s*([^\n,.]+)/i)?.[1] || "").trim() || "The organising team";
  const city = cityHit || (answers.match(/(?:city|venue|location)\s*:\s*([^\n,]+)/i)?.[1] || "").trim();

  const e: EventProfile = {
    name, organizer, dates: datePart || (years[0] ? `${years[0]}, dates to be confirmed` : "Dates to be confirmed"), city: city || "City to be confirmed",
    website: site, one_line: `${name}${organizer ? ` by ${organizer}` : ""}${city ? `, ${city}` : ""}: an event for ${A.short}.`,
    audience: `${sentenceCase(A.who)}, ages ${A.age} (typical for this kind of event). Size: ${sizeText}.`,
    audience_short: `${reach ? reach.toLocaleString("en-IN") + " " : ""}${A.short}`,
    past_sponsors: spons || `Searched ${relevant.length ? [...new Set(relevant.map((h) => /google\.com\/goto/.test(h.url) ? "web results" : host(h.url)))].slice(0, 3).join(", ") : "the web"}; no published sponsor list found. Add past sponsors in Edit details.`,
    proof: proofItems.filter((p) => p.verified).map((p) => `${p.claim} (${/google\.com\/goto/.test(p.url) ? "web result" : host(p.url)})`).join("; ") || (reach ? `Organiser's figure: ${reach.toLocaleString("en-IN")} attendees. Add a public link that shows it.` : "No published reach numbers found yet. Add last edition's numbers with a link."),
    proof_items: proofItems,
    tiers, floor_inr: floor, goal_inr: goal || tiers[0].price_inr + tiers[1].price_inr + 2 * tiers[2].price_inr + 3 * tiers[3].price_inr, floor_locked: false,
    inkind_needs: INKIND[type], models: MODELS.slice(0, 8), policies: "Never sell judging or awards; share attendee data only with opt-in.",
    sources: good, unverified_sources: checked.filter((c) => !c.verified),
    sender: { name: sender.name, title: sender.title || `Partnerships, ${name}`, org: organizer, phone: sender.phone || "", email: sender.email || "" },
    postal_address: addrLine || [organizer, city, pin].filter(Boolean).join(", "),
    event_type: type, reach: R,
    pricing_basis: (goal
      ? `Sized to your goal of ${lakh(goal)}: 1 Title, 2 Platinum, 4 Gold and 6 Silver deals reach it. A reach-based estimate (about INR 40 per attendee at ${R.toLocaleString("en-IN")}${reach ? "" : ", estimated"}) would put Title near ${lakh(reachTitle)}${title > reachTitle * 1.5 ? ": the goal needs more sponsors than that mix or stronger reach proof" : ""}.`
      : `Rule of thumb: about INR 40 per attendee for the title tier at ${R.toLocaleString("en-IN")} reach${reach ? "" : " (estimated)"}, adjusted for a ${type} event${big ? " at a well-known institute" : ""}.`) + " Lower tiers are 50%, 25% and 10% of Title. Check against what peer events charge before locking.",
  };
  return { status: "ok", profile: e, searches: trace.calls.length, verified: good.length };
}

// ---------- industry classes: fit, segment and the offer that suits them ----------
type IClass = "edtech" | "fintech" | "software" | "consumer" | "media" | "mobility" | "investor" | "hardware" | "health" | "industrial" | "services" | "unsafe" | "other";
const ICLASS: [IClass, RegExp][] = [
  ["unsafe", /tobacco|cigarette|gambling|casino|betting|liquor|alcohol|wine|spirits|brewer|distiller|adult entertainment|firearm|weapon/i],
  ["edtech", /e-learning|education|edtech|learning|tutor|coaching|test prep/i],
  ["investor", /venture capital|private equity|angel invest|accelerator|incubator/i],
  ["fintech", /financial|fintech|bank|payment|insurance|investment|capital markets|wealth|credit|lending|trading|broker/i],
  ["software", /software|it services|computer|internet|technology, information|data|cloud|saas|artificial intelligence|cyber|developer/i],
  ["consumer", /retail|consumer|food|beverage|dairy|snack|confection|bakery|mineral water|packaged water|restaurant|apparel|fashion|personal care|cosmetic|beauty|restaurant|e-?commerce|quick commerce|grocery|fmcg|wellness|fitness|sporting goods|luxury|furniture/i],
  ["media", /media|entertainment|gaming|games|music|broadcast|publishing|advertising|marketing services|film|streaming/i],
  ["mobility", /transport|travel|hospitality|hotel|automotive|mobility|airline|logistics/i],
  ["hardware", /telecom|electronics|semiconductor|hardware|appliances|computers and electronics/i],
  ["health", /health|hospital|pharma|medical|biotech/i],
  ["industrial", /manufactur|construction|energy|oil|mining|chemical|steel|cement|engineering/i],
  ["services", /consult|staffing|recruit|accounting|legal|outsourc/i],
];
const UNSAFE_DESC = /\b(tobacco|pan masala|gutka|gutkha|cigarettes?|liquor|whisk(e)?y|beer|casino|betting|gambling)\b/i;
const iclass = (industry: string, desc = "") => UNSAFE_DESC.test(desc.slice(0, 2000)) ? "unsafe" as IClass : (ICLASS.find(([, rx]) => rx.test(industry)) || ICLASS.find(([, rx]) => rx.test(desc.slice(0, 400))) || ["other"])[0] as IClass;
// How well each kind of company fits each kind of audience (0..1).
const FIT: Record<EventType, Partial<Record<IClass, number>>> = {
  entrepreneurship: { investor: 1, fintech: 0.9, software: 0.9, edtech: 0.7, consumer: 0.6, media: 0.5, services: 0.6, hardware: 0.5, mobility: 0.4, health: 0.4, industrial: 0.3 },
  tech: { software: 1, hardware: 0.9, edtech: 0.8, fintech: 0.8, investor: 0.5, consumer: 0.5, media: 0.6, mobility: 0.5, industrial: 0.5, services: 0.6, health: 0.4 },
  management: { fintech: 1, services: 0.9, consumer: 0.8, software: 0.7, edtech: 0.6, media: 0.6, investor: 0.7, mobility: 0.5, industrial: 0.5, health: 0.4, hardware: 0.4 },
  sports: { consumer: 1, media: 0.8, health: 0.7, mobility: 0.6, fintech: 0.5, hardware: 0.5, edtech: 0.4, software: 0.4 },
  cultural: { consumer: 1, media: 1, mobility: 0.7, fintech: 0.6, hardware: 0.6, edtech: 0.5, software: 0.4, health: 0.4 },
  conference: { software: 0.9, fintech: 0.8, services: 0.9, investor: 0.7, hardware: 0.7, media: 0.6, industrial: 0.6, health: 0.6, consumer: 0.5, edtech: 0.5, mobility: 0.5 },
  community: { software: 1, edtech: 0.7, hardware: 0.7, fintech: 0.6, media: 0.6, consumer: 0.5, investor: 0.6 },
  college: { consumer: 0.9, edtech: 0.9, media: 0.8, fintech: 0.7, software: 0.7, mobility: 0.6, hardware: 0.6, health: 0.4 },
};
const SEGMENT: Record<IClass, string> = { edtech: "brand", fintech: "brand", software: "developer", consumer: "brand", media: "brand", mobility: "brand", investor: "founder_ecosystem", hardware: "developer", health: "csr", industrial: "hiring", services: "hiring", unsafe: "brand", other: "brand" };
// Industry filter values for discovery (Crustdata professional_network_industry labels).
const DISCOVER_INDUSTRIES: Record<EventType, string[]> = {
  entrepreneurship: ["Venture Capital and Private Equity Principals", "Financial Services", "Software Development", "Technology, Information and Internet", "IT Services and IT Consulting", "E-Learning Providers"],
  tech: ["Software Development", "Technology, Information and Internet", "IT Services and IT Consulting", "Computer Hardware Manufacturing", "Semiconductor Manufacturing", "E-Learning Providers"],
  management: ["Financial Services", "Business Consulting and Services", "Banking", "Investment Management", "Retail", "Advertising Services"],
  sports: ["Retail Apparel and Fashion", "Sporting Goods Manufacturing", "Food and Beverage Services", "Food and Beverage Manufacturing", "Beverage Manufacturing", "Wellness and Fitness Services", "Entertainment Providers", "Online Audio and Video Media"],
  cultural: ["Retail Apparel and Fashion", "Food and Beverage Services", "Entertainment Providers", "Personal Care Product Manufacturing", "Online Audio and Video Media", "Retail"],
  conference: ["Software Development", "IT Services and IT Consulting", "Financial Services", "Business Consulting and Services", "Technology, Information and Internet"],
  community: ["Software Development", "Technology, Information and Internet", "IT Services and IT Consulting", "E-Learning Providers"],
  college: ["Technology, Information and Internet", "E-Learning Providers", "Retail", "Food and Beverage Services", "Financial Services", "Entertainment Providers"],
};

// ---------- A1: discover ----------
type Signal = { claim: string; source: string; date?: string };
function g(o: any, ...keys: string[]) { for (const k of keys) { const v = k.split(".").reduce((x, p) => (x == null ? x : x[p]), o); if (v != null) return v; } return null; }
function companySignals(c: any): Signal[] {
  const s: Signal[] = [];
  const fd = g(c, "funding.last_fundraise_date");
  if (fd && daysAgo(fd) < 400) {
    const amt = Number(g(c, "funding.last_round_amount_usd") || 0);
    s.push({ claim: `Raised ${roundName(g(c, "funding.last_round_type"))}${amt ? ` of USD ${amt >= 1e6 ? +(amt / 1e6).toFixed(1) + "M" : Math.round(amt / 1e3) + "K"}` : ""}`, source: "crustdata", date: String(fd).slice(0, 10) });
  }
  const gr6 = Number(g(c, "headcount.growth_percent.6m", "headcount.growth_percent.six_months"));
  const gr12 = Number(g(c, "headcount.growth_percent.12m", "headcount.growth_percent.yoy"));
  const hc = Number(g(c, "headcount.total") || 0);
  const glitch = (x: number) => x > (hc >= 1000 ? 80 : 200); // jumps like +180% at a 5,000-person company are renames or merges, not hiring
  if (isFinite(gr6) && !glitch(gr6) && Math.abs(gr6) >= 3) s.push({ claim: `Headcount ${gr6 > 0 ? "+" : ""}${Math.round(gr6)}% in 6 months${hc ? ` (now ${hc.toLocaleString("en-IN")})` : ""}`, source: "crustdata", date: new Date().toISOString().slice(0, 10) });
  else if (isFinite(gr12) && !glitch(gr12) && Math.abs(gr12) >= 5) s.push({ claim: `Headcount ${gr12 > 0 ? "+" : ""}${Math.round(gr12)}% in 12 months${hc ? ` (now ${hc.toLocaleString("en-IN")})` : ""}`, source: "crustdata", date: new Date().toISOString().slice(0, 10) });
  const open = Number(g(c, "hiring.openings_count") || 0);
  if (open >= 5) s.push({ claim: `${open} open roles${g(c, "hiring.recent_titles_csv") ? `, e.g. ${String(g(c, "hiring.recent_titles_csv")).split(",").slice(0, 2).join(",").trim()}` : ""}`, source: "crustdata", date: new Date().toISOString().slice(0, 10) });
  for (const n of (Array.isArray(c.news) ? c.news : []).filter((n: any) => CAMPUS.test(n.title || "") && daysAgo(n.date) < 730).slice(0, 2)) s.push({ claim: `In the news: ${n.title}`, source: n.url, date: n.date });
  return s;
}
const roundName = (t: any) => { const x = String(t || "").replace(/_/g, " ").trim(); if (!x || /unknown|undisclosed/i.test(x)) return "a funding round"; return x.replace(/\b(series|seed|pre|angel|debt|grant|venture|round|private|equity|secondary|market|corporate|convertible|note)\b/gi, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).replace(/\b([a-z])$/i, (m) => m.toUpperCase()); };
const CAUTION = /suspend|violat|ordered to pay|consumer (commission|court|forum)|overcharg|goes wrong|backlash|boycott|penalt|fined|\bfine of|\bban(s|ned)?\b|lawsuit|sued|recall|complaint|notice from|regulator|cci |sebi (order|notice)|data breach|leak/i;
const CAMPUS = /campus|college|fest\b|students?|universit|hackathon|youth|gen ?z|internship|iit|iim|summit|sponsor/i;
const DISTRESS = /layoff|lays off|laid off|job cuts|insolven|bankrupt|shuts? down|shutting down|winding up|fraud|raid|probe|default(s|ed)? on|delist|crisis/i;

/** Listings that are not sponsor companies: schemes, franchise offers, other events, careers pages, link-in-bio sites. */
function junk(c: any) {
  const name = String(g(c, "basic_info.name") || ""), desc = String(g(c, "basic_info.description") || "").slice(0, 1500);
  const dom = cleanDomain(g(c, "basic_info.primary_domain") || ""), web = String(g(c, "basic_info.website") || "");
  if (!dom || /linktr\.ee|wa\.me|whatsapp|bit\.ly|instagram\.com|facebook\.com|talent500|naukri|indeed|blogspot|wixsite|godaddysites/i.test(dom + " " + web)) return true;
  if (/work from home|franchise|dealership|distributorship|earn (from|at) home|unlimited earning|mlm|network marketing|direct selling|sourcing agent|we are recruiting/i.test(name + " " + desc)) return true;
  if (/\b(fest|festival|college|university|institute|school|society|club)\b/i.test(name)) return true;
  const gr = Number(g(c, "headcount.growth_percent.6m") || 0), hc = Number(g(c, "headcount.total") || 0);
  if (gr > 300 && hc < 1000) return true; // tiny company with a data jump
  return false;
}

export async function discover(e: EventProfile, count: number, exclude: string[]) {
  const trace = new CD.Trace();
  const type = e.event_type || eventType(`${e.name} ${e.one_line} ${e.audience}`);
  const since = new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10);
  const country = process.env.SD_COUNTRY || "IND";
  const base: CD.Filter[] = [
    { field: "locations.country", type: "=", value: country },
    // Real sponsors: 200+ people (bigger for bigger goals) and a real website.
    { field: "headcount.total", type: "=>", value: (e.goal_inr || 0) >= 3000000 ? 500 : 200 },
    { field: "basic_info.primary_domain", type: "is_not_null", value: null },
    { op: "or", conditions: [{ field: "funding.last_fundraise_date", type: "=>", value: since }, { field: "headcount.growth_percent.6m", type: "=>", value: 5 }] },
  ];
  if (exclude.length) base.push({ field: "basic_info.name", type: "not_in", value: exclude.slice(0, 500) });
  const want = Math.min(Math.max(count, 3), 25);
  // Sort by size, not growth %: growth sorting surfaces tiny companies with data glitches.
  const sorts = [{ field: "headcount.total", order: "desc" as const }];
  let rows = (await CD.searchCompanies({ op: "and", conditions: [...base, { field: "taxonomy.professional_network_industry", type: "in", value: DISCOVER_INDUSTRIES[type] }] }, want * 2, trace, sorts)).companies;
  if (rows.length < want) rows = rows.concat((await CD.searchCompanies({ op: "and", conditions: base }, want * 2, trace, sorts)).companies);
  const seen = new Set(exclude.map((x) => x.toLowerCase()));
  const companies: any[] = [];
  for (const c of rows) {
    const name = String(g(c, "basic_info.name") || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    const ind = String(g(c, "taxonomy.professional_network_industry") || "");
    const cls = iclass(ind, String(g(c, "basic_info.description") || ""));
    if (cls === "unsafe" || junk(c)) continue;
    seen.add(name.toLowerCase());
    const signals = companySignals(c);
    companies.push({
      name, domain: cleanDomain(g(c, "basic_info.primary_domain") || g(c, "basic_info.website") || ""), segment: SEGMENT[cls],
      why_now: signals.slice(0, 2).map((s) => s.claim).join("; ") || `${ind || "Growing company"} with an Indian presence`,
      signals, crustdata_company_id: g(c, "crustdata_company_id"), industry: ind,
    });
    if (companies.length >= want) break;
  }
  const raw: RawResult = { text: "", toolCalls: trace.toolCalls, sources: [], seen: [], credits: trace.credits };
  return { data: { companies }, raw };
}

// ---------- A1 + A2: analyse one company, find decision makers, write the priced offer ----------
export type FoundContact = { kind: "primary" | "alternative" | "fallback"; full_name: string; designation: string; department?: string; email?: string; email_source?: string;
  email_verified_by_crustdata?: boolean; phone?: string; phone_type?: string; phone_source?: string; responsibility?: string; evidence?: { claim: string; url: string; date?: string }[];
  evidence_date?: string; left_company?: boolean; reason?: string; one_liner?: string; hook?: string; iitb_alum?: string; warm_path?: string };
export type Factor = { factor: string; points: number; max: number; why: string };
export type Analysis = {
  decision: "keep" | "drop"; drop_reason?: string;
  signals: Signal[];
  our_pov: { score: number; factors: Factor[] };
  their_pov: { score: number; factors: Factor[] };
  model: string; tier: string; price_range: string; angle: string; audience_benefit: string;
  role_map: { champion?: string; budget_owner?: string; agency?: string; procurement?: string };
  contacts?: FoundContact[];
  company_contact?: { email?: string; phone?: string; source?: string };
  company_size?: number;
  contact?: any; backup_contact?: any;
  email: { subject: string; body: string } | null;
};

type Offer = { model: string; activation: (co: string, ev: string) => string; metric: string; tracking: string; benefit: string };
const OFFERS: Record<string, Offer> = {
  activation: { model: "activation", activation: (co) => `a ${co} experience zone`, metric: "app installs or sign-ups", tracking: "a referral code only this event uses", benefit: "Attendees get hands-on time with the product and an event-only offer." },
  offer_codes: { model: "offer_codes", activation: (co) => `a ${co} attendee offer drop`, metric: "code redemptions", tracking: "a unique offer code", benefit: "Attendees get a real discount they can use the same day." },
  hiring: { model: "hiring", activation: (co) => `a ${co} hiring challenge`, metric: "applications and shortlists", tracking: "your own applicant tracking system", benefit: "Attendees get a direct path to interviews and internships." },
  case_competition: { model: "case_competition", activation: (co) => `a ${co} case challenge`, metric: "registrations and finalist submissions", tracking: "a registration form you own", benefit: "Participants work on a real problem and get feedback from the team." },
  workshop: { model: "workshop", activation: (co) => `a ${co} build workshop`, metric: "sign-ups to your platform", tracking: "a UTM link", benefit: "Attendees learn a skill hands-on from the team that builds the product." },
  services_credits: { model: "services_credits", activation: (co) => `${co} credits for every team`, metric: "activated accounts", tracking: "a promo code", benefit: "Every team gets credits to build with." },
  prize_pool: { model: "prize_pool", activation: (co) => `a ${co} prize track`, metric: "submissions that use your product", tracking: "the submission form", benefit: "Builders compete for a prize judged on real use of the product." },
  brand_integration: { model: "brand_integration", activation: (co, ev) => `${co} presents the ${ev} main stage`, metric: "reach and impressions on official posts", tracking: "post analytics shared weekly", benefit: "Attendees get a better show, with the sponsor visible all day." },
  sampling: { model: "product_inkind", activation: (co) => `${co} sampling and refreshment zone`, metric: "samples handed out and QR-code scans", tracking: "a QR code only this event uses", benefit: "Attendees try the product for free, right when they need it." },
  product_inkind: { model: "product_inkind", activation: (co) => `${co} as official product partner`, metric: "samples handed out and code redemptions", tracking: "a unique code", benefit: "Attendees try the product for free." },
  csr: { model: "csr", activation: (co) => `a ${co} community impact track`, metric: "people reached by the programme", tracking: "a shared impact sheet", benefit: "Participants work on a social problem with real mentors." },
};
function pickOffer(cls: IClass, type: EventType, hc: number, hiringUp: boolean, digital = true): Offer {
  if (cls === "investor") return type === "entrepreneurship" ? OFFERS.case_competition : OFFERS.workshop;
  if (cls === "software" || cls === "hardware") return type === "tech" || type === "community" ? (hc < 500 ? OFFERS.services_credits : OFFERS.prize_pool) : hiringUp && hc >= 500 ? OFFERS.hiring : OFFERS.workshop;
  if (cls === "services" || cls === "industrial") return OFFERS.hiring;
  if (cls === "fintech") return type === "management" || type === "entrepreneurship" ? OFFERS.case_competition : OFFERS.activation;
  if (cls === "health") return OFFERS.csr;
  if (cls === "consumer") return !digital ? OFFERS.sampling : hc >= 1000 ? OFFERS.activation : OFFERS.product_inkind;
  if (cls === "media") return OFFERS.brand_integration;
  if (cls === "edtech") return OFFERS.activation;
  return hiringUp && hc >= 500 ? OFFERS.hiring : OFFERS.activation;
}

const TITLE_WORDS: Record<string, string[]> = {
  brand: ["brand", "marketing", "partnerships", "sponsorship", "campus", "communications", "alliances"],
  event: ["partnerships", "sponsorship", "alliances", "events", "campus", "employer branding", "university relations", "developer relations", "community", "ecosystem", "talent acquisition"],
  csr: ["csr", "foundation", "sustainability", "social impact", "corporate communications", "community"],
};

function ownDomain(email: string, domains: string[]) {
  const d = String(email || "").toLowerCase().split("@")[1] || "";
  if (!d) return false;
  // Brand label: "bisleri" in bisleri.co.in, "amul" in amul.coop, "zee" in in.zee.com.
  const label = (h: string) => { const p = h.split("."); const sld = p.length >= 3 && /^(co|com|org|net|ac|gov|edu)$/.test(p[p.length - 2]); return p[p.length - (sld ? 3 : 2)] || ""; };
  return domains.some((c) => c && (d === c || d.endsWith("." + c) || (label(d).length >= 4 && label(d) === label(c))));
}

/** "Bisleri" from "Bisleri International Pvt Ltd" + bisleri.com; "Tata Play" from tataplay.com; else drop legal suffixes. */
function brandName(name: string, domain: string) {
  const label = cleanDomain(domain).split(".")[0];
  const words = name.replace(/\(.*?\)/g, " ").trim().split(/\s+/);
  let acc = "";
  for (let i = 0; i < words.length && label; i++) { acc += words[i].toLowerCase().replace(/[^a-z0-9]/g, ""); if (acc === label) return words.slice(0, i + 1).join(" "); if (!label.startsWith(acc)) break; }
  return name.replace(/\(.*?\)/g, "").replace(/\b(pvt\.?|private|ltd\.?|limited|inc\.?|llp|corp(oration)?|co\.)(?=\s|$)/gi, "").replace(/\s+/g, " ").trim() || name;
}

export async function analyze(e: EventProfile, company: { name: string; domain?: string; why_now?: string; crustdata_company_id?: number }) {
  const trace = new CD.Trace();
  const type = e.event_type || eventType(`${e.name} ${e.one_line} ${e.audience}`);
  const c = await CD.enrichCompany({ crustdata_company_id: company.crustdata_company_id, domain: company.domain, name: company.name }, trace);
  const raw = (): RawResult => ({ text: "", toolCalls: trace.toolCalls, sources: [], seen: [...trace.urls], credits: trace.credits });
  if (!c) {
    const empty = { score: 0, factors: [] as Factor[] };
    return { data: { decision: "drop", drop_reason: "Crustdata has no record of this company; add it by hand with its domain", signals: [], our_pov: empty, their_pov: empty, model: "", tier: "", price_range: "", angle: "", audience_benefit: "", role_map: {}, email: null } as Analysis, raw: raw() };
  }
  const coName = String(g(c, "basic_info.name") || company.name);
  const brand = brandName(coName, String(g(c, "basic_info.primary_domain") || company.domain || ""));
  const cid = Number(g(c, "crustdata_company_id", "basic_info.crustdata_company_id") || company.crustdata_company_id || 0) || null;
  const domain = cleanDomain(g(c, "basic_info.primary_domain") || company.domain || g(c, "basic_info.website") || "");
  const domains = [domain, ...((g(c, "basic_info.all_domains") || []) as string[]).map(cleanDomain)].filter(Boolean);
  const industry = String(g(c, "taxonomy.professional_network_industry") || (g(c, "basic_info.industries") || [])[0] || "");
  const desc = String(g(c, "basic_info.description") || "");
  const cls = iclass(industry + " " + ((g(c, "basic_info.industries") || []) as string[]).join(" "), desc);
  const hc = Number(g(c, "headcount.total") || 0);
  const gr6 = Number(g(c, "headcount.growth_percent.six_months", "headcount.growth_percent.6m") ?? NaN);
  const inv = Number(g(c, "funding.total_investment_usd") || 0);
  const lastFund = g(c, "funding.last_fundraise_date");
  const fundAge = daysAgo(lastFund);
  const openings = Number(g(c, "hiring.openings_count") || 0);
  const openYoy = Number(g(c, "hiring.openings_growth_percent.yoy") || 0);
  // News matched by name can be about something else ("VLCC" is also a class of oil tanker). For short names,
  // keep an article only if it shares a word with what the company actually does.
  const STOP = /^(their|there|which|about|across|india|indian|company|companies|years|world|leading|brand|brands|backed|market|markets|record|report|price|prices|potential|group|global|business|services|through|offers|offering|first|largest|growth|solutions|products|quality|people|today|since|every|other|under|while|where|after|before|million|billion|crore|share|shares|deal|deals|stake|owner|value|level|highs?)$/;
  const stem = (w: string) => w.slice(0, 6);
  const descStems = new Set(`${desc} ${industry}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5 && !STOP.test(w)).map(stem));
  const VOCAB: Partial<Record<IClass, RegExp>> = {
    consumer: /beauty|skin|hair|salon|cosmetic|wellness|fitness|slimming|weight loss|food|snack|dairy|milk|ice ?cream|mineral water|drink|beverage|juice|store|outlet|retail|fashion|apparel|flavou?r|consumer|fmcg|restaurant|menu/i,
    media: /channel|show|series|film|movie|ott|stream|tv|broadcast|content|audience|viewers?|music|podcast|audio|episode|ad revenue|advertis/i,
    software: /software|cloud|ai\b|app|platform|developer|saas|data|cyber|tech/i, fintech: /bank|loan|credit|payment|upi|card|insur|invest|wallet|fintech|lending/i,
    edtech: /learn|student|course|exam|education|edtech|tutor|school|college/i, health: /health|hospital|pharma|medic|clinic|patient|drug/i,
  };
  const shortName = (String(g(c, "basic_info.name") || company.name).replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/)[0] || "").length <= 5;
  const clsEarly = iclass(`${industry} ${((g(c, "basic_info.industries") || []) as string[]).join(" ")}`, desc);
  // Short names: industry vocabulary only (description words like "welcome" or "backed" caused false matches).
  const NOISE = /\b(tanker|freight|vessel|shipping|crude|charter|dwt|stocks?|share price|shares (rise|fall|jump|slip)|investors?|52-week|nse|bse|sensex|nifty|trading window)\b/i;
  const onTopic = (t: string) => !NOISE.test(t) && (!shortName || /sponsor|campus|college|fest\b|hackathon|students?|universit/i.test(t) || (VOCAB[clsEarly] ? VOCAB[clsEarly]!.test(t) : t.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 6 && !STOP.test(w) && descStems.has(stem(w)))));
  const allNews: { title: string; url: string; date: string }[] = (Array.isArray(c.news) ? c.news : []).filter((n: any) => !NOISE.test(String(n.title || "")) || DISTRESS.test(String(n.title || "")));
  const news = allNews.filter((n) => onTopic(String(n.title || "")));
  const recent = news.filter((n) => daysAgo(n.date) < 180);
  const recentAll = allNews.filter((n) => daysAgo(n.date) < 180);
  const distress = recentAll.filter((n) => DISTRESS.test(n.title || ""));
  const campusNews = news.filter((n) => CAMPUS.test(n.title || "") && daysAgo(n.date) < 730);
  const signals = companySignals(c);
  for (const n of distress.slice(0, 2)) signals.push({ claim: `Negative signal: ${n.title}`, source: n.url, date: n.date });
  for (const n of recentAll.filter((n) => !DISTRESS.test(n.title) && CAUTION.test(n.title || "")).slice(0, 2)) signals.push({ claim: `Caution (check before pitching): ${n.title}`, source: n.url, date: n.date });
  for (const n of recent.filter((n) => !DISTRESS.test(n.title) && !CAUTION.test(n.title || "") && !CAMPUS.test(n.title) && !/shares|in focus|stock/i.test(n.title)).slice(0, 2)) signals.push({ claim: `Recent news: ${n.title}`, source: n.url, date: n.date });
  const sources: Source[] = news.slice(0, 6).map((n) => ({ url: n.url, title: n.title }));
  for (const s of sources) trace.urls.add(s.url);

  // Hard drops: brand safety and distress.
  const policyBlock = e.policies && new RegExp(`no (${cls})`, "i").test(e.policies);
  const dropReason = cls === "unsafe" ? `brand-safety category (${industry || "restricted product"})`
    : distress.length >= 2 || (isFinite(gr6) && gr6 <= -15) ? `company in distress: ${distress[0]?.title || `headcount ${Math.round(gr6)}% in 6 months`}`
    : policyBlock ? "event policy excludes this category" : "";

  // People: who owns this budget, from Crustdata's people dataset.
  const hiringUp = openYoy > 0 || openings >= 10;
  const digital = /\bapp\b|online|digital|platform|e-?commerce|delivery|subscription|ott|streaming|software|fintech|payments?|internet/i.test(`${industry} ${desc}`);
  const offer = pickOffer(cls, type, hc, hiringUp, digital);
  const kind = sponsorKind(SEGMENT[cls], offer.model);
  const words = [...new Set([...TITLE_WORDS[kind], ...(offer.model === "hiring" ? ["talent acquisition", "campus", "university relations", "employer brand"] : [])])];
  let people: any[] = [];
  if (!dropReason) { try { people = await CD.searchPeople(cid, coName, words, 12, trace); } catch (err: any) { signals.push({ claim: `People search failed: ${String(err.message).slice(0, 120)}`, source: "crustdata" }); } }
  const orgWords = `${e.organizer} ${e.name}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !/^(the|team|club|cell|fest|summit|society|college|event)$/.test(w));
  const coWord = (coName.toLowerCase().match(/[a-z]{4,}/) || [""])[0].replace(/s$/, "");
  const cands = people.map((p) => {
    const cur = (g(p, "experience.employment_details.current") || []).find((x: any) => !cid || !x.crustdata_company_id || Number(x.crustdata_company_id) === cid || String(x.name || "").toLowerCase() === coName.toLowerCase()) || (g(p, "experience.employment_details.current") || [])[0] || {};
    const title = String(cur.title || g(p, "basic_profile.headline") || "");
    const schools: string[] = (g(p, "education.schools") || []).map((s: any) => String(s.school || ""));
    const alum = orgWords.length >= 1 && schools.some((s) => orgWords.filter((w) => s.toLowerCase().includes(w)).length >= Math.min(2, orgWords.length));
    const url = String(g(p, "social_handles.professional_network_identifier.profile_url") || "");
    // Ranking: role fit and authority. The record is current as of today, so tenure is not staleness.
    const prelim = scoreContact({ position: title, responsibility: "", emailStatus: "UNAVAILABLE", phoneStatus: "UNAVAILABLE", evidenceDate: new Date().toISOString().slice(0, 10), companySize: hc }, kind);
    const channel = /trade marketing|performance marketing|subscriber|e-?commerce|\bseo\b|\bcrm\b|\b(regional|area|zonal|territory)\b|retention|acquisition marketing/i.test(title) && !/head|chief|vp|vice president|director/i.test(title) ? 12 : 0;
    const junior = /\b(assistant|associate|executive|intern|trainee|coordinator|specialist|staff)\b/i.test(title) && !/(associate|assistant) (vice president|director|general manager)|\bhead\b/i.test(title) ? 8 : 0;
    // A newer "current" job at another company usually means they moved on.
    const moved = (g(p, "experience.employment_details.current") || []).find((x: any) => x !== cur && x.crustdata_company_id && cid && Number(x.crustdata_company_id) !== cid && String(x.start_date || "") > String(cur.start_date || "0"));
    return { name: String(g(p, "basic_profile.name") || ""), title, start: String(cur.start_date || "").slice(0, 10), url, alum, schools, moved: moved ? `${moved.title} at ${moved.name} since ${String(moved.start_date || "").slice(0, 7)}` : "", hasEmail: !!g(p, "contact.has_business_email"), prelim: prelim.score + (g(p, "contact.has_business_email") ? 6 : 0) - (moved ? 60 : 0) - channel - junior };
  }).filter((x) => x.name && x.title && !(coWord && x.name.toLowerCase().replace(/[^a-z]/g, "").includes(coWord))).sort((a, b) => b.prelim - a.prelim); // a page named after the company is not a person
  const top = cands.slice(0, 2);
  // Business emails only for the two best people (2 credits each). Keep an address only if it belongs to THIS company.
  let mails: Record<string, { email: string; status: string; company_id?: number }[]> = {};
  if (top.some((t) => t.url)) { try { mails = await CD.businessEmails(top.map((t) => t.url), trace); } catch { mails = {}; } }
  const contacts: FoundContact[] = top.map((t, i) => {
    const list = mails[CD.normUrl(t.url)] || [];
    // The address itself must be on the company's domain (or a same-brand variant like bisleri.co.in for bisleri.com).
    // A matching company id alone is not enough: Crustdata can tag an old employer's address with the new company.
    const mine = list.find((m) => ownDomain(m.email, domains));
    const verified = !!mine && /^(valid|verified|deliverable|ok)$/i.test(mine.status);
    const owns = /sponsor|partnership|alliance|brand|campus|event|experiential|employer brand|university|csr|community|developer relations|chief marketing|\bcmo\b|head[\s,&-]*(of\s+)?marketing|marketing head/i.test(t.title);
    const since = monthYear(t.start);
    return {
      kind: i === 0 ? "primary" : "alternative", full_name: t.name, designation: t.title,
      email: mine?.email || "", email_source: mine ? `crustdata (${mine.status})` : "", email_verified_by_crustdata: verified,
      responsibility: owns ? `Current title "${t.title}" at ${coName}${since ? ` since ${since}` : ""} (Crustdata)` : "",
      evidence: [{ claim: `${t.title} at ${coName}${since ? ` since ${since}` : ""}`, url: t.url, date: t.start }],
      evidence_date: new Date().toISOString().slice(0, 10), left_company: !!t.moved,
      reason: t.moved ? `May have left: now also listed as ${t.moved}` : owns ? "Title shows they own brand, partnership or campus budgets" : "Closest available role to sponsorship at this company",
      one_liner: `${t.title} at ${coName}${since ? `, in the role since ${since}` : ""}.`,
      hook: t.alum ? `Studied at ${t.schools.find((s) => orgWords.some((w) => s.toLowerCase().includes(w)))}` : "",
      iitb_alum: t.alum ? "yes" : t.schools.length ? "no" : "unknown", warm_path: t.alum ? "Alumnus of the organising institute: ask the alumni cell for an introduction" : "",
    } as FoundContact;
  });
  const cEmail = String(g(c, "funding.contact_email") || "");
  const cPhone = String(g(c, "funding.phone_number") || "");
  const companyContact = cEmail || cPhone ? { email: domains.some((d) => cEmail.toLowerCase().endsWith("@" + d)) && !/^(support|care|help|helpdesk|customercare|customer\.?care|grievance|complaints?|noreply|no-reply|feedback|orders?|refunds?)@/i.test(cEmail) ? cEmail : "", phone: cPhone, source: "crustdata" } : undefined;
  const alumAny = cands.some((x) => x.alum);
  const ownerAny = cands.some((x) => /sponsor|partnership|brand|campus/i.test(x.title));

  // Scores. Every point has a reason.
  const fit = (FIT[type][cls] ?? 0.4);
  const tiers = [...(e.tiers || [])].sort((a, b) => b.price_inr - a.price_inr);
  const payIdx = hc >= 5000 || inv >= 300e6 ? 0 : hc >= 1000 || inv >= 50e6 ? 1 : hc >= 200 || inv >= 10e6 ? 2 : 3;
  const tIdx = clamp(payIdx + (fit < 0.55 ? 1 : 0), 0, Math.max(0, tiers.length - 1));
  const hcPts = hc >= 5000 ? 12 : hc >= 1000 ? 10 : hc >= 200 ? 7 : hc >= 50 ? 4 : 2;
  const fundPts = fundAge < 180 ? 13 : fundAge < 365 ? 10 : inv >= 50e6 ? 8 : inv > 0 ? 5 : 3;
  const our: Factor[] = [
    { factor: "Ability to pay", points: hcPts + fundPts, max: 25, why: `${hc ? hc.toLocaleString("en-IN") + " employees" : "headcount not listed"}; ${lastFund ? `last round ${String(lastFund).slice(0, 10)}` : "no funding data"}${inv ? `, USD ${+(inv / 1e6).toFixed(1)}M raised in total` : ""}` },
    { factor: "Brand fit and prestige", points: Math.round(fit * 14) + (hc >= 1000 || inv >= 50e6 ? 6 : hc >= 200 ? 3 : 1), max: 20, why: `${industry || cls} for a ${type} audience (fit ${Math.round(fit * 100)}%)` },
    { factor: "Likelihood to close", points: Math.min(20, (campusNews.length ? 8 : 0) + (alumAny ? 7 : 0) + (ownerAny ? 5 : cands.length ? 2 : 0)), max: 20, why: [campusNews.length ? "campus or event activity in the news" : "", alumAny ? "alumni of the organiser on their team" : "", ownerAny ? "a sponsorship-relevant owner found" : cands.length ? "only adjacent roles found" : "no decision maker found"].filter(Boolean).join("; ") },
    { factor: "Deal size vs our tiers", points: [15, 12, 9, 6][Math.min(3, tIdx)], max: 15, why: `fits ${tiers[tIdx]?.name || "the smallest tier"}` },
    { factor: "Value beyond cash", points: ["consumer", "software", "hardware", "edtech"].includes(cls) || offer.model === "hiring" ? 8 : 4, max: 10, why: offer.model === "hiring" ? "internships and hiring for attendees" : ["consumer", "software", "hardware", "edtech"].includes(cls) ? "product or credits can cover our in-kind needs" : "mainly cash" },
    { factor: "Effort (procurement load)", points: hc > 10000 ? 4 : hc > 1000 ? 6 : hc > 200 ? 8 : 10, max: 10, why: hc > 10000 ? "large company: vendor onboarding and POs likely" : hc > 1000 ? "mid-size: some procurement" : "small team: fast decisions" },
  ];
  const m = new Date().getMonth(); // Indian FY Apr-Mar
  const timing = fundAge < 180 ? 10 : m >= 3 && m <= 5 ? 10 : m >= 6 && m <= 8 ? 8 : m >= 9 && m <= 11 ? 6 : 3;
  const live = Math.min(25, (fundAge < 180 ? 12 : fundAge < 365 ? 8 : 0) + (gr6 >= 10 ? 8 : gr6 >= 3 ? 4 : 0) + (hiringUp ? 5 : 0));
  const their: Factor[] = [
    { factor: "Audience match", points: Math.round(fit * 30), max: 30, why: `${AUDIENCE[type].short} vs ${industry || cls} customers or hires` },
    { factor: "Live objective right now", points: live, max: 25, why: signals.filter((s) => s.source === "crustdata").map((s) => s.claim).slice(0, 2).join("; ") || "no fresh growth signal" },
    { factor: "Channel habit (campus and events)", points: campusNews.length ? 15 : cls === "consumer" || cls === "media" ? 7 : 3, max: 15, why: campusNews.length ? `news: ${campusNews[0].title.slice(0, 90)}` : "no event or campus spend seen" },
    { factor: "Measurable ROI available", points: ["consumer", "software", "fintech", "edtech"].includes(cls) ? 15 : cls === "media" ? 10 : 6, max: 15, why: ["consumer", "software", "fintech", "edtech"].includes(cls) ? "digital product: sign-ups and codes are trackable" : "harder to track" },
    { factor: "Budget timing (Indian FY)", points: timing, max: 10, why: fundAge < 180 ? "fresh funding" : ["Jan to Mar: budgets closing", "Apr to Jun: new budgets", "Jul to Sep: mid-year", "Oct to Dec: H2 plans"][m <= 2 ? 0 : m <= 5 ? 1 : m <= 8 ? 2 : 3] },
    { factor: "Competitive pressure", points: ["fintech", "edtech", "consumer"].includes(cls) ? 5 : 3, max: 5, why: ["fintech", "edtech", "consumer"].includes(cls) ? "crowded category: rivals compete for the same audience" : "moderate" },
  ];
  const sum = (f: Factor[]) => f.reduce((s, x) => s + x.points, 0);

  const tier = tiers[tIdx];
  const lower = tiers[tIdx + 1];
  const price = tier ? (lower ? `${lakh(lower.price_inr).replace("INR ", "INR ")} to ${lakh(tier.price_inr).replace("INR ", "")}` : `${lakh(tier.price_inr)}`) : "in-kind";
  const activation = offer.activation(brand, e.name);
  const best = contacts[0];
  const hookSignal = signals.find((s) => s.source === "crustdata" && /Raised/.test(s.claim) && daysAgo(s.date) < 180) || signals.find((s) => /Headcount \+/.test(s.claim)) || signals.find((s) => /open roles/.test(s.claim));
  const opener = !hookSignal ? `${brand} came up while we looked for partners who fit our audience.`
    : /Raised/.test(hookSignal.claim) ? `Congratulations on the ${hookSignal.claim.replace(/^Raised (a |an )?/, "").replace(/ of USD.*/, "")}${monthYear(hookSignal.date) ? ` in ${monthYear(hookSignal.date)}` : ""}.`
    : /Headcount/.test(hookSignal.claim) ? `${brand} has grown its team by ${(hookSignal.claim.match(/\+(\d+)%/) || [])[1] || "a good margin"}% in six months.`.replace("margin%", "margin")
    : `${brand} is hiring across ${hookSignal.claim.match(/^\d+/)?.[0]} roles right now.`;
  const audienceLine = `${e.name}${e.dates && !/confirmed/.test(e.dates) ? ` (${e.dates}${e.city && !/confirmed/.test(e.city) ? `, ${e.city}` : ""})` : ""} brings together ${e.audience_short || AUDIENCE[type].short}.`;
  const proofItem = (e.proof_items || []).find((p) => p.verified);
  const body = [
    `Hi ${first(best?.full_name)},`,
    `${opener} ${audienceLine}${proofItem ? ` Track record: ${proofItem.claim}.` : ""}`,
    `Proposal: ${activation}${activation.includes(e.name) ? "" : ` at ${e.name}`}, ${price}, measured on ${offer.metric} through ${offer.tracking}, so the result sits in your own numbers.`,
    `Reply 'send' for the one-page plan.`,
    `If this is not relevant, reply 'no' and I will not follow up.`,
  ].join("\n\n");
  const subject = `${brand} at ${e.name}`.split(/\s+/).slice(0, 7).join(" ");

  const a: Analysis = {
    decision: dropReason ? "drop" : "keep", drop_reason: dropReason,
    signals, our_pov: { score: sum(our), factors: our }, their_pov: { score: sum(their), factors: their },
    model: offer.model, tier: tier?.name || "", price_range: price,
    angle: `${hookSignal ? hookSignal.claim : industry || "Good audience fit"}. Offer: ${activation}, in front of ${AUDIENCE[type].short}.`,
    audience_benefit: offer.benefit,
    role_map: { champion: best ? `${best.full_name}, ${best.designation}` : "", budget_owner: cands.find((x) => /chief|cmo|vp|vice president|head/i.test(x.title))?.title || "", agency: "", procurement: hc > 1000 ? "Likely: vendor onboarding needs PAN, GST and bank letter" : "" },
    contacts: dropReason ? [] : contacts, company_contact: companyContact, company_size: hc,
    email: dropReason ? null : { subject, body: fixDashes(body) },
  };
  const r = raw(); r.sources = sources;
  return { data: a, raw: r };
}

// ---------- A2: follow-ups (templates) ----------
export async function followUp(e: EventProfile, c: { name: string; angle: string; price_range: string; model: string }, _firstEmail: string, step: number, firstName: string) {
  if (step === 1) {
    const small = [...(e.tiers || [])].sort((a, b) => a.price_inr - b.price_inr)[0];
    const alt = c.model === "product_inkind" || c.model === "services_credits"
      ? `a cash-light version: ${c.name} covers part of our needs in kind (${(e.inkind_needs || "prizes, food, credits").split(",").slice(0, 2).join(" and ").trim()}) instead of a fee`
      : `a smaller start: the ${small?.name || "entry"} package at ${lakh(small?.price_inr || 0)}, or in-kind support such as ${(e.inkind_needs || "prizes").split(",")[0].trim()}`;
    const proof = (e.proof_items || []).find((p) => p.verified);
    return `Hi ${firstName},\n\nOne more option for ${c.name}: ${alt}.${proof ? ` For scale, last edition saw ${proof.claim}.` : ""}\n\nReply 'send' for the one-page plan.\n\nIf this is not relevant, reply 'no' and I will not follow up.`;
  }
  return `Hi ${firstName},\n\nI will take the silence as not this time, and this is my last note on it. If event or campus budgets sit with someone else at ${c.name}, a name would help. The inbox stays open until ${e.dates || "the event"}.`;
}

// ---------- Reply classifier: rules only, no model, so an email cannot instruct it ----------
export const LABELS = ["interested", "meeting", "need_info", "referral", "not_now", "not_interested", "opt_out", "auto_reply", "bounce"] as const;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseDate(t: string): string | null {
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
  const m1 = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(20\d{2})?/i);
  const m2 = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})?/i);
  const [d, mon, y] = m1 ? [m1[1], m1[2], m1[3]] : m2 ? [m2[2], m2[1], m2[3]] : [];
  if (!d) return null;
  const now = new Date(); const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
  let yr = y ? Number(y) : now.getFullYear();
  if (!y && new Date(yr, mi, Number(d)) < new Date(now.getTime() - 7 * 86400e3)) yr++;
  return `${yr}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export async function classify(text: string) {
  const body = text.replace(/\r/g, "");
  // Ignore the quoted thread so our own words ("reply 'no'") do not classify their reply.
  const fresh = body.split(/\n(?:on .{5,80} wrote:|-{2,} ?original message|from: .*\nsent: )/i)[0];
  const t = fresh.toLowerCase();
  const head = (fresh.match(/^subject:.*$/im)?.[0] || "").toLowerCase();
  const suspicious = /ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)|disregard (the|your|all)|you are (an? )?(ai|assistant|language model)|system prompt|as an ai|other compan(y|ies)'?s? (data|details|emails|contacts)|(list|share) (all |your )?(other )?(sponsors|clients|contacts) (emails|data|details)|reveal your|jailbreak/i.test(fresh);
  let label: (typeof LABELS)[number] = "need_info";
  const has = (rx: RegExp) => rx.test(t) || rx.test(head);
  if (/\[delivery failure notice\]|mailer-daemon|postmaster/.test(t) || has(/undeliverable|delivery (status notification|has failed|failure)|address (not found|couldn'?t be found)|mailbox (unavailable|not found|full)|user unknown|recipient (address )?rejected/)) label = "bounce";
  else if (has(/out of (the )?office|automatic reply|auto-?reply|autoreply|on (annual |paternity |maternity |sick )?leave|away from (the )?office|limited access to email|currently travell?ing|will be back|i am away|back in office/)) label = "auto_reply";
  else if (has(/unsubscribe|remove me|take me off|stop (emailing|sending|contacting)|do not (contact|email|write)|don'?t (contact|email|write)|opt(ing)? out/)) label = "opt_out";
  else if (/^\s*(no|nope|no thanks?|no, thanks?|not interested)[.!]?\s*$/im.test(fresh.split(/\n\n/)[0] || fresh) || has(/not interested|not a (good )?fit|we('ll| will) pass|pass on this|decline|not for us|won'?t be able to (support|sponsor|participate)|not able to (support|sponsor)/)) label = "not_interested";
  else if (has(/(reach out to|get in touch with|contact|speak (to|with)|connect with|write to|loop(ing)? in|cc'?ing|cc'?d|copying|forward(ed|ing)? (this|it|your email) to)\s+(?!me\b|us\b|you\b|our\b|the team\b)[a-z]+|right person|better person|handles (this|sponsorships|partnerships)|owns (this|these)/)) label = "referral";
  else if (has(/\b(call|meet|meeting|catch up|zoom|google meet|teams|discuss (this )?(over|on)|chat (on|over)|schedule|slot|available (on|at|this|next)|free (on|at|this|next)|works for me at)\b/) && !has(/^\s*no\b/)) label = "meeting";
  else if (has(/^\s*send\b|\bsend (it|the plan|over|across|me|us|details|deck)|interested|sounds (good|great|interesting)|keen|let'?s (do|go|proceed|move)|go ahead|share (the )?(plan|deck|details|proposal|deck)|happy to (explore|proceed|consider)|we can (do|offer|pay|commit)|would like to (sponsor|partner|proceed)|budget of|we('d| would) like to/)) label = "interested";
  else if (has(/next (year|quarter|edition|financial year|fy)|not (right )?now|later this year|after (the )?(quarter|q[1-4]|budget)|budget (is )?(exhausted|closed|frozen|allocated)|no budget|circle back in|revisit in|maybe later|not this (year|time)/)) label = "not_now";
  else if (/\?/.test(fresh)) label = "need_info";
  // Amount they would pay: only near pay words, never our own prices quoted back.
  let offer_inr: number | null = null;
  for (const sent of fresh.split(/(?<=[.!?\n])\s+/)) {
    if (/\b(can|could|would|will|able to|budget|offer|pay|do|commit|stretch|max(imum)?|only|upto|up to)\b/i.test(sent)) { const a = parseInr(sent); if (a.length) { offer_inr = Math.max(...a); break; } }
  }
  if (offer_inr !== null && label === "need_info") label = "interested";
  const return_date = label === "auto_reply" ? parseDate((fresh.match(/(until|till|back (on|by)|return(ing)? (on|by)|from)\s+[^\n.]{3,40}/i) || [fresh])[0]) : null;
  const referral_name = label === "referral" ? (fresh.match(/(?:reach out to|get in touch with|contact|speak (?:to|with)|connect with|write to|looping in|cc'?ing|copying)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] || "") : "";
  const proposed_times = [...fresh.matchAll(/\b((mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b[^.\n]{0,30}?\b\d{1,2}(:\d{2})?\s*(am|pm)?|\d{1,2}(:\d{2})?\s*(am|pm)\b[^.\n]{0,20})/gi)].map((m) => m[0].trim()).slice(0, 4);
  const DESC: Record<string, string> = { interested: "Interested and wants the plan or to go ahead", meeting: "Asks for a call or meeting", need_info: "Has questions before deciding", referral: "Points to another person", not_now: "Not now; suggests a later time", not_interested: "Declined", opt_out: "Asked not to be contacted again", auto_reply: "Automatic out-of-office reply", bounce: "Delivery failure" };
  const firstLine = fresh.replace(/^(from|subject|to|date):.*$/gim, "").replace(/\[[^\]]*\]/g, "").split(/\n/).map((s) => s.trim()).find((s) => s.length > 3 && !/^(hi|hello|dear)\b/i.test(s)) || "";
  const extras = [offer_inr ? `mentions INR ${offer_inr.toLocaleString("en-IN")}` : "", return_date ? `back on ${return_date}` : "", referral_name ? `refers to ${referral_name}` : "", proposed_times.length ? `times offered: ${proposed_times.join(", ")}` : ""].filter(Boolean).join("; ");
  const summary = `${DESC[label]}${extras ? ` (${extras})` : ""}. First line: "${firstLine.slice(0, 140)}"`;
  return { label, summary: summary.slice(0, 400), offer_inr, return_date, proposed_times, suspicious, referral_name };
}

// ---------- Reply draft (always approved by a human) ----------
export async function draftReply(e: EventProfile, c: any, replySummary: string, label: string, firstName: string, deckUrl?: string) {
  const plan = deckUrl || "(the plan link will be added)";
  const offer = `${String(c.model || "partnership").replace(/_/g, " ")}${c.price_range ? `, ${c.price_range}` : ""}`;
  const ref = replySummary.match(/refers to ([^;)]+)/)?.[1];
  const bodies: Record<string, string> = {
    interested: `Hi ${firstName},\n\nThank you. Here is the one-page plan for ${c.name}: ${plan}\n\nIt includes a short business case you can forward internally. When procurement needs them, our vendor documents (PAN, GST certificate, bank letter) are ready.\n\nIf a 20 minute call helps to settle the details, reply with a time that suits you.`,
    need_info: `Hi ${firstName},\n\nThank you for the questions. The one-page plan answers most of them: ${plan}\n\nIn short: ${offer}, measured on numbers from your own systems. Anything still open, reply here and I will answer the same day.`,
    meeting: `Hi ${firstName},\n\nHappy to talk. Would Tuesday or Wednesday afternoon this week (IST) work for a 20 minute call? Pick a time and a calendar invite will follow.`,
    referral: `Hi ${firstName},\n\nThank you for pointing me to ${ref || "the right person"}. I will write to them with the plan and copy you, unless you would rather introduce us.`,
  };
  const body = bodies[label] || bodies.need_info;
  return noFloor(e, async () => ({ subject: `Re: ${c.name} x ${e.name}`, body }));
}

// ---------- A3: scheduling ----------
export const MEETING_TEMPLATES: Record<string, string> = {
  first_call: "First call after an interested reply: 20 minutes on Google Meet, offer the slots, invite them to propose another time.",
  executive: "Senior executive, formal: 20 minutes to understand their priorities and share a partnership outline; offer to coordinate via their office.",
  assistant: "Coordinating through an executive assistant: ask for help finding 20 minutes for the named executive, offer the slots.",
  team: "Multiple stakeholders on their side: offer four options across the week, one invite with a short agenda will follow.",
  second_meeting: "Follow-up meeting: reference the last call, the purpose of this one, 30 minutes, agenda in one line.",
  in_person: "In person: offer to host them at the venue or visit their office.",
  reschedule: "They asked to move the meeting: offer two new slots, say the existing invite will be moved.",
};
export async function scheduleEmail(e: EventProfile, c: any, firstName: string, template: string, slots: string[], meetingN: number, lastNotes?: string) {
  const list = slots.map((s) => `- ${s}`).join("\n");
  const T: Record<string, [string, string]> = {
    first_call: [`${c.name} x ${e.name}: 20 minute call`, `Thank you for the reply. Could we take 20 minutes on Google Meet to walk through the plan? These times work on our side (IST):\n\n${list}\n\nIf none suits, propose another and I will make it work.`],
    executive: [`${c.name} x ${e.name}: 20 minutes`, `I would value 20 minutes to understand ${c.name}'s priorities for the coming months and share a short partnership outline. These times work on our side (IST):\n\n${list}\n\nHappy to coordinate through your office if that is easier.`],
    assistant: [`20 minutes for ${c.name} x ${e.name}`, `Could you help find 20 minutes for a short call about ${c.name}'s partnership with ${e.name}? Options (IST):\n\n${list}`],
    team: [`${c.name} x ${e.name}: options for the team`, `To make it easy for everyone on your side, here are four options this week (IST):\n\n${list}\n\nOne invite with a short agenda will follow once you pick.`],
    second_meeting: [`${c.name} x ${e.name}: next conversation`, `${lastNotes ? `Following our last call (${lastNotes.split(/[.\n]/)[0].slice(0, 120)}), ` : "Following our last call, "}a 30 minute session to agree the package and timeline. Agenda: final deliverables, dates, next steps. Times (IST):\n\n${list}`],
    in_person: [`${c.name} x ${e.name}: meeting in person`, `Would you like to meet in person? We can host you at the venue${e.city && !/confirmed/.test(e.city) ? ` in ${e.city}` : ""} or visit your office. Times that work for us:\n\n${list}`],
    reschedule: [`New time: ${c.name} x ${e.name}`, `No problem at all. Two new options (IST):\n\n${list}\n\nI will move the existing invite once you pick one.`],
  };
  const [subject, main] = T[template] || T.first_call;
  return { subject: meetingN > 1 && template === "first_call" ? `${c.name} x ${e.name}: meeting ${meetingN}` : subject, body: `Hi ${firstName},\n\n${main}` };
}

// ---------- A4: company-specific deck and talk track (assembled from the record) ----------
export type Deck = { title: string; thesis: string; slides: { kind: string; heading: string; body: string[]; stat?: string; stat_label?: string; notes: string }[]; talk_track: { opening: string; discovery: string[]; pitch: string; objections: { they: string; we: string }[]; close: string }; one_pager: { headline: string; bullets: string[]; ask: string } };
export async function makeDeck(e: EventProfile, c: any, contact: any, meetingNotes?: string) {
  const type = e.event_type || eventType(`${e.name} ${e.one_line}`);
  const offer = OFFERS[c.model] || OFFERS.activation;
  const act = offer.activation(c.name, e.name);
  const sig: Signal[] = (c.reasons?.signals || []).filter((s: Signal) => !/^(Negative|Caution)|failed/.test(s.claim)).slice(0, 3);
  const tiers = [...(e.tiers || [])].sort((a, b) => b.price_inr - a.price_inr);
  const mid = tiers.findIndex((t) => t.name === c.tier);
  const opts = (mid >= 0 ? [tiers[mid + 1], tiers[mid], tiers[mid - 1]] : tiers.slice(1, 4)).filter(Boolean) as Tier[];
  const proof = (e.proof_items || []).filter((p) => p.verified).slice(0, 3);
  const slides: Deck["slides"] = [
    { kind: "cover", heading: `${c.name} x ${e.name}`, body: [e.one_line || "", `${e.dates}${e.city && !/confirmed/.test(e.city) ? `, ${e.city}` : ""}`].filter(Boolean), notes: `Open with why ${c.name}, not with us.` },
    { kind: "goal", heading: `What ${c.name} is working on`, body: sig.length ? sig.map((s) => `${s.claim}${s.date ? ` (${s.date})` : ""}`) : [c.angle || `Growth with ${AUDIENCE[type].short}`], notes: "Signals from Crustdata. Ask them to correct anything out of date." },
    { kind: "audience", heading: "Who you will reach", body: [e.audience_short || AUDIENCE[type].short, e.audience.split(/\. /)[0]], stat: e.reach ? e.reach.toLocaleString("en-IN") : undefined, stat_label: e.reach ? "expected attendees" : undefined, notes: "Only numbers we can show a source for." },
    { kind: "idea", heading: sentenceCase(act), body: [offer.benefit, `Built around ${c.name}'s goal: ${(sig[0]?.claim || c.angle || "").slice(0, 80)}`], notes: "Name it as theirs. Offer to adjust the format." },
    { kind: "deliverables", heading: "What you get", body: (tiers.find((t) => t.name === c.tier)?.deliverables || tiers[0]?.deliverables || "").split(/,\s*/).slice(0, 7), notes: "Each deliverable has a quantity and a date in the MOU." },
    { kind: "measurement", heading: "How it is measured", body: [`Primary metric: ${offer.metric}`, `Tracked through ${offer.tracking}`, "Weekly numbers during the campaign, full report within 10 days of the event"], notes: "Their systems, not ours." },
    { kind: "proof", heading: "Proof", body: proof.length ? proof.map((p) => `${p.claim} (${host(p.url)})`) : ["First edition with this format: we will report every number listed on the previous slide"], notes: "Never quote unsourced numbers." },
    { kind: "options", heading: "Ways to partner", body: opts.map((t) => `${t.name}: ${lakh(t.price_inr)}. ${t.deliverables.split(",").slice(0, 3).join(",")}`).concat(["In-kind: " + (e.inkind_needs || "products, credits or services").split(",").slice(0, 3).join(",")]), notes: "Recommend the middle option." },
    { kind: "timeline", heading: "Timeline", body: ["This week: agree the package", "Within 10 days: MOU signed", "4 weeks before: content and promotion live", `${e.dates}: event`, "10 days after: results report"], notes: "Tie any discount talk to these dates." },
    { kind: "next", heading: "Next step", body: [`Confirm the ${c.tier || "recommended"} package by ${plusDays(7)}`, `Contact: ${e.sender?.name || ""}${e.sender?.email ? `, ${e.sender.email}` : ""}`], notes: "One ask, one date." },
  ];
  return {
    title: `${c.name} x ${e.name}`,
    thesis: `${sentenceCase(act)} gives ${c.name} measurable reach with ${e.audience_short || AUDIENCE[type].short}.`,
    slides,
    talk_track: {
      opening: `Thanks for the time${contact?.full_name ? `, ${first(contact.full_name)}` : ""}. I have 20 minutes planned: your goals first, then one idea, then options.`,
      discovery: ["What does success look like for your team this quarter?", "Who else needs to sign off on a partnership like this?", "Have you sponsored events before? What worked and what did not?", "How do you track sign-ups or hires today?", "Is there a budget window we should plan around?"],
      pitch: `${sentenceCase(act)}. ${offer.benefit} We measure it on ${offer.metric} through ${offer.tracking}. Recommended package: ${c.tier || "Gold"}, ${c.price_range || ""}.`,
      objections: [
        { they: "We have no budget right now.", we: `Then start without cash: ${(e.inkind_needs || "products or credits").split(",")[0].trim()} in kind, with the same reporting.` },
        { they: "Send me a proposal.", we: "Happy to. Which one number would make this a yes for you, so the proposal leads with it?" },
        { they: "Events do not show ROI.", we: `That is why it is measured on ${offer.metric} in your own systems, with weekly numbers.` },
        { they: "It is too expensive.", we: "We can trade deliverables, not cut the price of the same package. Which items matter least to you?" },
      ],
      close: `Can we agree the package by ${plusDays(7)}, so the MOU is signed before promotion starts?`,
    },
    one_pager: {
      headline: `${c.name} x ${e.name}: ${act}`,
      bullets: [`Audience: ${e.audience_short || AUDIENCE[type].short}`, `Idea: ${act}`, `Metric: ${offer.metric}, tracked through ${offer.tracking}`, `Package: ${c.tier || ""} ${c.price_range ? `(${c.price_range})` : ""}`.trim(), meetingNotes ? `What we heard: ${meetingNotes.slice(0, 160)}` : ""].filter(Boolean),
      ask: `Confirm by ${plusDays(7)}.`,
    },
  } as Deck;
}

// ---------- A5: meeting notes to recap + next steps (extraction rules) ----------
export async function digestMeeting(e: EventProfile, c: any, notes: string, firstName: string) {
  const clean = notes.replace(/\r/g, "").slice(0, 15000);
  const sents = clean.split(/\n+|(?<=[.!?])\s+/).map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim()).filter((s) => s.length > 6);
  const conf = /competitor|confidential|off the record|between us|don'?t share|do not share/i;
  const safe = sents.filter((s) => !conf.test(s));
  const pick = (rx: RegExp, n = 4) => [...new Set(safe.filter((s) => rx.test(s)))].slice(0, n);
  const goals = pick(/\b(want|wants|looking for|goal|objective|aim|interested in|focus|priority|need to reach|target)\b/i);
  const objections = pick(/\b(concern|worried|worry|but |however|expensive|costly|too high|not sure|unclear|risk|hesitant|pushback)\b/i);
  const exceptions = pick(/exclusiv|discount|attendee (data|list)|participant data|resume (data|dump)|judg|jury|free of cost|waive|refund|pay after|post-?event payment|credit period|change the contract|logo on (the )?trophy/i, 3);
  const nextHead = clean.search(/next steps|action items|suggested next steps|to-?dos?/i);
  const nextLines = nextHead >= 0 ? clean.slice(nextHead).split(/\n/).slice(1, 12).map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim()).filter((s) => s.length > 6) : [];
  const due = (s: string) => s.match(/\b(by|before|on)\s+((mon|tue|wed|thu|fri|sat|sun)[a-z]*|\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\s+\d{1,2}|tomorrow|next week|end of (the )?week|eod)\b/i)?.[0] || "";
  const ours = [...new Set([...nextLines.filter((s) => /\b(we|our|us|i)\b|send|share|draft|prepare|revise|update/i.test(s)), ...pick(/\b(we will|we'll|our team will|i will|i'll|we can send|will send|will share)\b/i)])].slice(0, 5);
  const theirs = [...new Set([...nextLines.filter((s) => /\b(they|their|you|client|sponsor)\b/i.test(s) && !ours.includes(s)), ...pick(/\b(they will|they'll|will check|will confirm|will get back|internal approval|loop in)\b/i)])].filter((s) => !ours.includes(s)).slice(0, 4);
  const budget = pick(/budget|₹|\binr\b|\brs\.?\b|lakh|crore|\bk\b|price|cost|spend/i, 2);
  const amounts = budget.flatMap((s) => parseInr(s));
  const offer_inr = amounts.length ? Math.max(...amounts) : null;
  const hot = /\b(confirmed|go ahead|green ?light|approved|signed|sign the mou|purchase order|let'?s do it|book it|finali[sz]ed|we are in|we're in)\b/i.test(clean);
  const cold = /\b(not interested|no budget|not a fit|decline|pass on|unlikely|deprioriti[sz]e)\b/i.test(clean);
  const temperature = hot && !cold ? "hot" : cold && !hot ? "cold" : "warm";
  const decision = pick(/approv|sign[- ]?off|decide|decision|procurement|legal|finance team|cmo|head of/i, 2).join(" ");
  const nextMeeting = /\b(next (call|meeting)|follow[- ]up (call|meeting)|meet again|another call)\b/i.test(clean);
  const summary = [
    `${c.name}: ${temperature} after the meeting.`,
    goals[0] ? `They want: ${goals[0].slice(0, 140)}` : "Goals not stated clearly in the notes.",
    ours.length || theirs.length ? `${ours.length} action(s) on us, ${theirs.length} on them.` : "No clear next steps in the notes: agree them by email.",
  ].join(" ");
  const bullets = (xs: string[]) => xs.map((x) => `- ${x.replace(/\.$/, "")}`).join("\n");
  const recapBody = [
    `Hi ${firstName},`,
    `Thank you for the time today. A short recap so everyone on your side has the same picture.`,
    goals.length ? `What you are looking for:\n${bullets(goals.slice(0, 3))}` : "",
    `What we suggested: ${String(c.model || "a partnership").replace(/_/g, " ")}${c.price_range ? `, ${c.price_range}` : ""}.`,
    ours.length || theirs.length ? `Next steps:\n${bullets([...ours.map((s) => `${e.sender?.org || "Us"}: ${s}${due(s) ? "" : ""}`), ...theirs.map((s) => `${c.name}: ${s}`)].slice(0, 6))}` : `Next step: we will send the updated plan by ${plusDays(3)}.`,
    `If I missed anything, reply and I will correct it.`,
  ].filter(Boolean).join("\n\n");
  return {
    summary, their_goals: goals, budget_signal: budget.join(" ") || "not discussed", decision_process: decision || "not discussed",
    objections, asks_from_them: theirs, promises_by_us: ours.map((s) => ({ item: s, due: due(s) || "agree a date" })),
    next_meeting_wanted: nextMeeting, temperature, exceptions: exceptions.map((s) => `asked: ${s.slice(0, 160)}`), offer_inr,
    recap: { subject: `Re: ${c.name} x ${e.name}: recap`, body: fixDashes(recapBody) },
  };
}

// ---------- A5: counter-offer for below-floor offers ----------
/** True if a sponsor-facing text reveals the internal floor. */
export function leaksFloor(text: string, floor?: number) {
  const t = (text || "").toLowerCase();
  if (/\bfloor\b|minimum (price|amount|budget)|lowest we can/.test(t)) return true;
  if (!floor) return false;
  const plain = String(floor), indian = Number(floor).toLocaleString("en-IN"), lk = String(+(floor / 100000).toFixed(2));
  return t.replace(/\s/g, "").includes(plain) || t.includes(indian) || new RegExp(`\\b${lk.replace(".", "\\.")}\\s*(l\\b|lakh|lac)`).test(t);
}
async function noFloor<T extends { body: string }>(e: EventProfile, make: (extra: string) => Promise<T>): Promise<T> {
  const r = await make("");
  if (leaksFloor(r.body, e.floor_inr)) (r as any).floor_warning = "This draft mentions the internal floor. Edit it before approving.";
  return r;
}
export async function counterOffer(e: EventProfile, c: any, offerInr: number, _replySummary: string, firstName: string) {
  const tiers = [...(e.tiers || [])].sort((a, b) => a.price_inr - b.price_inr);
  const lowest = tiers[0];
  const key = (lowest?.deliverables || "logo and one social post").split(",")[0].trim();
  const inkind = (e.inkind_needs || "prizes, food and beverage").split(",").slice(0, 2).join(" and ").trim();
  const decideBy = plusDays(10);
  const body = [
    `Hi ${firstName},`,
    `Thank you for coming back with a number. We cannot cut the price of the same package, but we can change what is in it. Three ways to make ${lakh(offerInr)} work:`,
    `A) The ${lowest?.name || "entry"} package with ${key.toLowerCase()} kept and the rest trimmed to fit.\nB) Your amount in cash plus in-kind support from ${c.name} (${inkind}), which keeps the full package.\nC) No cash at all: ${c.name} covers ${inkind} in kind, in return for the matching branding.`,
    `If one of these works, could you confirm by ${decideBy}? That is when our print and promotion files lock.`,
  ].join("\n\n");
  const recommendation = `Offer INR ${offerInr.toLocaleString("en-IN")} is below the floor of INR ${(e.floor_inr || 0).toLocaleString("en-IN")}. Draft offers three trades instead of a discount: smaller package, cash plus in-kind, or fully in-kind. Approve only if the in-kind value closes the gap.`;
  return noFloor(e, async () => ({ recommendation, subject: `Re: ${c.name} x ${e.name}`, body }));
}

// ---------- A6: MOU (template) ----------
export async function mou(e: EventProfile, c: any, deal: { tier: string; cash_inr: number; in_kind: string; deliverables: string; sponsor_entity: string; sponsor_signatory: string; payment_terms: string }) {
  const rows = String(deal.deliverables || "").split(/\n|;|,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  const cash = Number(deal.cash_inr || 0);
  const md = `Draft for review by the organiser's authorised office before signing.

# Memorandum of Understanding: ${c.name} x ${e.name}

## 1. Parties
1.1 **${e.organizer || "The organiser"}**, organiser of ${e.name}, ${e.postal_address || ""} ("the Organiser").
1.2 **${deal.sponsor_entity || `${c.name} (legal entity to confirm)`}**, represented by ${deal.sponsor_signatory || "an authorised signatory (to confirm)"} ("the Sponsor").

## 2. Purpose
2.1 The Sponsor partners with ${e.name} (${e.dates}${e.city && !/confirmed/.test(e.city) ? `, ${e.city}` : ""}) as **${deal.tier}** partner, on the terms below.

## 3. What the Sponsor receives
| # | Deliverable | Quantity | Timing | Proof |
|---|---|---|---|---|
${(rows.length ? rows : ["As listed in the agreed package"]).map((r, i) => `| ${i + 1} | ${r} | as stated | before or during the event | photo, link or report |`).join("\n")}

## 4. What the Sponsor provides
4.1 Cash: ${cash ? `INR ${cash.toLocaleString("en-IN")} plus GST as applicable to the invoicing entity` : "none"}.
4.2 In kind: ${deal.in_kind || "none"}.
4.3 Brand assets (logo files, guidelines) within 5 working days of signing.

## 5. Payment
5.1 ${deal.payment_terms || "50% within 15 days of the purchase order or signing, 50% 15 days before the event"}.
5.2 The Organiser invoices against the Sponsor's purchase order where the Sponsor uses one. TDS as applicable.

## 6. Brand use and approvals
6.1 Each party uses the other's name and logo only for this partnership.
6.2 The Sponsor approves creatives within 3 working days. No response after 5 working days counts as approval for routine posts only.

## 7. Exclusivity
7.1 ${/exclusiv/i.test(deal.deliverables + deal.in_kind) ? "Category exclusivity as stated in the deliverables table." : "None, unless added in writing."}

## 8. Changes and cancellation
8.1 Changes to deliverables need written agreement from both parties.
8.2 If the event is cancelled by the Organiser, unused cash is refunded within 30 days. If it is moved, the Sponsor may keep the partnership for the new dates or take the refund.
8.3 Neither party is liable for delays caused by events outside its reasonable control.

## 9. Confidentiality
9.1 Commercial terms stay confidential. Attendee data is shared only with the attendee's opt-in consent.

## 10. Term
10.1 From signing until 30 days after the event, when the final report is delivered.

## 11. Signatures
| For the Organiser | For the Sponsor |
|---|---|
| Name: authorised signatory of ${e.organizer || "the Organiser"} | Name: ${deal.sponsor_signatory || ""} |
| Signature: | Signature: |
| Date: | Date: |
`;
  return fixDashes(md);
}

// ---------- A7: sponsor update (template from the team's own news) ----------
export async function sponsorUpdate(e: EventProfile, c: any, deal: any, news: string, firstName: string) {
  const lines = news.split(/\n+|(?<=[.!?])\s+/).map((s) => s.replace(/^[-*•\s]+/, "").trim()).filter((s) => s.length > 3);
  const headline = (lines.find((s) => /\d/.test(s)) || lines[0] || "progress this fortnight").replace(/\.$/, "");
  const mine = lines.filter((s) => new RegExp(c.name.split(/\s+/)[0], "i").test(s));
  const next = String(deal?.deliverables || c.tier || "").split(/\n|;|,/).map((s: string) => s.trim()).filter(Boolean)[0];
  const body = [
    `Hi ${firstName},`,
    `${headline}.`,
    `Since last time:\n${lines.slice(0, 4).map((s) => `- ${s.replace(/\.$/, "")}`).join("\n")}`,
    `Coming up for ${c.name}: ${mine[0] ? mine[0].replace(/\.$/, "") : next ? `${next}, on track` : "the next deliverable, on track"}.`,
  ].join("\n\n");
  const short = headline.split(/\s+/).slice(0, 5).join(" ");
  return { subject: `${e.name} update for ${c.name}: ${short}`.split(/\s+/).slice(0, 8).join(" "), body };
}
