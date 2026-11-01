// Display helpers shared by every desk screen.
export type Any = any;

export async function api(path: string, body?: Any) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("sd-signed-out"));
    throw Object.assign(new Error("Your session ended. Please sign in again."), { code: 401 });
  }
  if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export const inr = (n: Any) => (n || n === 0 ? "₹" + Number(n).toLocaleString("en-IN") : "");
export function lakh(n: number) {
  n = Number(n) || 0;
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(n >= 1e6 ? 1 : 2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
export const when = (s?: string) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
export const clock = (s?: string) => (s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");
export function ago(s?: string) {
  if (!s) return "";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}
export function nextSlots(n = 3) {
  const out: string[] = [];
  const d = new Date();
  const hours = [11, 15];
  let i = 0;
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const h = hours[i++ % 2];
    out.push(`${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${h === 11 ? "11:00" : "15:30"} IST`);
  }
  return out;
}
export function localInput(daysAhead = 2, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const host = (d: string) => (d || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
export function brandName(c: Any) {
  return String(c?.reasons?.about?.brand || c?.name || "").replace(/\(.*?\)/g, "").replace(/\b(pvt\.?|private|ltd\.?|limited)\b/gi, "").replace(/\s+/g, " ").trim();
}
export function initials(s: string) {
  return String(s || "?").replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
/** Stable hue per company so its avatar keeps one colour everywhere. */
export function hue(s: string) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const STAGE_LABEL: Record<string, string> = {
  PROSPECT: "Found", QUALIFIED: "Scored", CONTACT_READY: "Contact found", CONTACTED: "Offer sent", FOLLOWUP_1: "Follow-up 1", FOLLOWUP_2: "Follow-up 2",
  REPLIED: "Replied", MEETING_REQUESTED: "Meeting asked", MEETING_SCHEDULED: "Meeting booked", MEETING_DONE: "Met", NEGOTIATING: "Negotiating",
  MOU_DRAFTED: "MOU drafted", MOU_SENT: "MOU sent", MOU_SIGNED: "MOU signed", PO_RECEIVED: "PO received", INVOICED: "Invoiced", PAID: "Paid",
  INKIND_CONFIRMED: "In-kind confirmed", NURTURE: "Nurture", DELIVERED: "Delivered", REPORTED: "Reported", RENEWAL: "Renewal",
  NO_RESPONSE: "No response", LOST: "Lost", OPTED_OUT: "Opted out", BOUNCED: "Bounced", DISQUALIFIED: "Dropped", PARKED: "Parked",
};
export const COLUMNS = [
  { title: "Research", hint: "found, scored, contact ready", stages: ["PROSPECT", "QUALIFIED", "CONTACT_READY"] },
  { title: "Outreach", hint: "offer and follow-ups", stages: ["CONTACTED", "FOLLOWUP_1", "FOLLOWUP_2"] },
  { title: "Talking", hint: "replied, meetings", stages: ["REPLIED", "MEETING_REQUESTED", "MEETING_SCHEDULED", "MEETING_DONE"] },
  { title: "Negotiating", hint: "terms and trades", stages: ["NEGOTIATING"] },
  { title: "Closing", hint: "MOU to invoice", stages: ["MOU_DRAFTED", "MOU_SENT", "MOU_SIGNED", "PO_RECEIVED", "INVOICED"] },
  { title: "Won", hint: "paid and delivered", stages: ["PAID", "INKIND_CONFIRMED", "NURTURE", "DELIVERED", "REPORTED", "RENEWAL"] },
  { title: "Closed out", hint: "no, dropped, parked", stages: ["NO_RESPONSE", "LOST", "OPTED_OUT", "BOUNCED", "DISQUALIFIED", "PARKED"] },
];

export const AGENTS = [
  { id: "A0", name: "Package", job: "Turns your brief into a priced event package", needs: "your brief", gives: "tiers and a floor" },
  { id: "A1", name: "Prospect", job: "Finds sponsors with fresh budget and scores both sides", needs: "a locked floor", gives: "a priority list" },
  { id: "A2", name: "Outreach", job: "Finds the decision maker and writes the priced offer", needs: "a scored company", gives: "drafts for approval" },
  { id: "A3", name: "Schedule", job: "Books calls with Google Meet links", needs: "a reply asking to talk", gives: "a booked meeting" },
  { id: "A4", name: "Pitch", job: "Builds a deck about that sponsor's goals", needs: "a scored company", gives: "a shareable deck" },
  { id: "A5", name: "Negotiate", job: "Digests meetings and counters with trades", needs: "meeting notes or an offer", gives: "recap and counter" },
  { id: "A6", name: "Close", job: "Drafts the MOU and sends it for signature", needs: "an agreed deal", gives: "an MOU" },
  { id: "A7", name: "Nurture", job: "Keeps signed sponsors updated", needs: "a signed sponsor", gives: "fortnightly updates" },
  { id: "Email", name: "Email agent", job: "Lints, waits for approval, sends once", needs: "an approved draft", gives: "a sent email" },
] as const;
export const OP_AGENT: Record<string, string> = { brief: "A0", lock_floor: "A0", prefs: "A0", discover: "A1", analyze: "A1", rediscover: "A1", set_email: "A2", prepare_outreach: "A2", replies: "A2", simulate: "A2", schedule: "A3", confirm_meeting: "A3", deck: "A4", notes: "A5", gemini_notes: "A5", resolve: "A5", mou: "A6", send_mou: "A6", nurture: "A7", send: "Email", approve: "Email", approve_many: "Email", cycle: "Email" };
export const isHuman = (a: string) => !/^(A\d|Email|Orchestrator|email|cycle|agent|a\d)$/i.test(a);

export const VLABEL: Record<string, string> = { VERIFIED: "Verified", CORROBORATED: "Corroborated", UNVERIFIED: "Unverified", UNAVAILABLE: "Not available", OUTDATED: "Outdated" };
const MODELS: Record<string, string> = { product_inkind: "Sampling / in-kind", brand_integration: "Brand integration", activation: "Activation zone", offer_codes: "Offer codes", hiring: "Hiring challenge", case_competition: "Case challenge", workshop: "Workshop", services_credits: "Credits", prize_pool: "Prize track", csr: "CSR track", cash_tier: "Cash tier" };
export const MODEL_LABEL = (m: string) => MODELS[m] || String(m || "").replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
/** Log rows a person cares about: hides internal bookkeeping (queue keys, auto-approvals, raw stage moves). */
export const visibleLog = (l: Any) => !["queue", "stage"].includes(l.action) && !(l.actor === "agent" && /^approve|queue/.test(l.action)) && !/:cold:\d|:reply:|:meeting:/.test(String(l.detail || ""));
