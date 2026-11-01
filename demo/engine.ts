// Stands in for the server on GitHub Pages. Answers the app's /api calls in the browser from sample data.
// No request leaves the browser and no email is ever sent; "sent" here only changes a status in local storage.
import { EVENT, initialState, offerBody, PEOPLE_FOR_NEW, priorityOf, RESERVE, scored, slug } from "./data";

type Any = any;
const KEY = "sponsordesk-demo-v1";
let s: Any = null;

function state() {
  if (s) return s;
  try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch { /* storage blocked */ }
  return (s = s || initialState());
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const co = (id: string) => state().companies.find((c: Any) => c.id === id);
const primary = (id: string) => { const l = state().contacts.filter((c: Any) => c.company_id === id); return l.find((c: Any) => c.is_primary) || l[0]; };
const lakhs = (n: number) => `₹${n / 100000} lakh`;
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

function log(actor: string, company_id: string | null, action: string, detail: string, to_stage: string | null = null) {
  state().log.unshift({ id: rid("l"), ts: now(), actor, company_id, action, from_stage: null, to_stage, detail });
}
function stage(id: string, st: string) { const c = co(id); if (c) { c.stage = st; c.updated_at = now(); } }
function draft(company_id: string, sequence: string, subject: string, body: string, step = 0) {
  const ct = primary(company_id);
  const key = `${company_id}:${sequence}:${step}:${Date.now()}`;
  state().messages.unshift({ id: rid("m"), key, contact_id: ct?.id, company_id, to_email: ct?.email || "", sequence, step, subject, body, gate: "approval", status: "drafted", approved_by: null, scheduled_for: null, sent_at: null, cancel_reason: null, attempts: 0, created_at: now() });
  return key;
}
function analyze(id: string) {
  const c = co(id);
  if (!c) throw new Error("Unknown company");
  const seed = [...c.name].reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
  const ours = c.our_pov ?? 55 + (seed % 30), theirs = c.their_pov ?? 52 + ((seed * 7) % 30), fit = Math.min(ours, theirs);
  const tier = EVENT.tiers[fit >= 78 ? 1 : fit >= 65 ? 2 : 3];
  const why = c.why_now || "Added by hand";
  const angle = c.angle || `A tracked student activation for ${c.name} at the fest.`;
  Object.assign(c, { our_pov: ours, their_pov: theirs, intersection: fit, priority: priorityOf(fit), tier: c.tier || tier.name, price_range: c.price_range || lakhs(tier.price_inr), angle, model: c.model || "cash_tier", reasons: scored(c.name, c.segment || "Consumer", ours, theirs, why, angle) });
  if (!primary(id)) {
    const person = PEOPLE_FOR_NEW[seed % PEOPLE_FOR_NEW.length];
    state().contacts.push({ id: `ct-${id}`, company_id: id, full_name: person, position: "Marketing Manager", department: "Marketing", email: `${person.split(" ")[0].toLowerCase()}@${c.domain || id + ".example"}`, email_status: "VERIFIED", phone: "", one_liner: `Marketing Manager at ${c.name}`, context: [], evidence: [], relevance: 80, relevance_parts: [], email_check: ["format ok", "domain ok"], reason: "Owns brand budgets.", warm_path: "", status: "active", is_primary: 1, kind: "primary", created_at: now() });
  }
  if (["PROSPECT", "QUALIFIED"].includes(c.stage)) stage(id, "CONTACT_READY");
  if (!state().messages.some((m: Any) => m.company_id === id && m.sequence === "cold")) draft(id, "cold", `${c.name} x ${state().event.name}`, offerBody(c, primary(id)));
  log("A1", id, "scored", `Scored ${c.name} at ${fit}/100 and drafted the offer`);
  return { ok: true };
}
function amountIn(t: string) {
  const l = t.match(/(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:lakh|lac)/i);
  if (l) return Math.round(Number(l[1]) * 100000);
  const n = t.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i);
  return n ? Number(n[1].replace(/,/g, "")) : null;
}
function classify(t: string) {
  if (/not interested|no budget|unsubscribe|remove me/i.test(t)) return "not_interested";
  if (/call|talk|meet|thursday|friday|monday|tuesday|wednesday/i.test(t)) return "meeting";
  if (/details|deck|more info|brochure/i.test(t)) return "need_info";
  return "interested";
}

function act(b: Any) {
  const st = state(), who = st.me.name, id = String(b.company_id || "");
  const msg = (k: string) => st.messages.find((m: Any) => m.key === k);
  switch (b.op) {
    case "brief": {
      const line = String(b.line || "");
      st.event = { ...st.event, one_line: line, name: line.split(/[,.]/)[0].trim().slice(0, 60) || st.event.name, sender: { ...st.event.sender, ...(b.sender || {}) }, sponsor_categories: b.prefs?.categories || [], wanted_brands: b.prefs?.brands || [], floor_locked: false };
      log("A0", null, "brief", "Packaged the event: tiers and a floor. Sample pricing in this demo.");
      return { ok: true };
    }
    case "prefs": st.event.sponsor_categories = b.prefs?.categories || []; st.event.wanted_brands = b.prefs?.brands || []; return { ok: true };
    case "lock_floor": st.event.floor_inr = Number(b.floor); st.event.floor_locked = true; log(who, null, "lock_floor", `Floor locked at ${inr(b.floor)}`); return { ok: true };
    case "discover": {
      const free = RESERVE.filter(([n]) => !co(slug(n))).slice(0, Math.max(1, Number(b.count || 5)));
      const added = free.map(([name, segment, why]) => {
        const nid = slug(name);
        st.companies.push({ id: nid, name, domain: `${nid}.example`, segment, stage: "PROSPECT", stage_reason: "sample", our_pov: null, their_pov: null, intersection: null, priority: "", model: "", tier: "", price_range: "", angle: "", why_now: why, sources: [], role_map: {}, reasons: { about: { brand: name, industry: segment } }, updated_at: now() });
        log("A1", nid, "found", `Found ${name}: ${why}`);
        return nid;
      });
      return { ok: true, added };
    }
    case "analyze": case "rediscover": return analyze(id);
    case "add_company": {
      const name = String(b.name || "").trim();
      if (!name) throw new Error("Company name is required.");
      const nid = slug(String(b.domain || name));
      if (!co(nid)) st.companies.push({ id: nid, name, domain: String(b.domain || ""), segment: "Consumer", stage: "PROSPECT", stage_reason: "added by hand", our_pov: null, their_pov: null, intersection: null, priority: "", why_now: String(b.note || ""), sources: [], role_map: {}, reasons: {}, updated_at: now() });
      log(who, nid, "add_company", String(b.note || `Added ${name}`));
      return { ok: true, id: nid };
    }
    case "set_email": { const c = st.contacts.find((x: Any) => x.id === b.contact_id); if (c) { c.email = String(b.email || ""); c.email_status = "UNVERIFIED"; } return { ok: true }; }
    case "contact_reviewed": { const c = st.contacts.find((x: Any) => x.id === b.contact_id); if (c) c.reviewed_at = now(); return { ok: true }; }
    case "set_primary": { const c = st.contacts.find((x: Any) => x.id === b.contact_id); if (c) st.contacts.filter((x: Any) => x.company_id === c.company_id).forEach((x: Any) => { x.is_primary = x.id === c.id ? 1 : 0; }); return { ok: true }; }
    case "prepare_outreach": { const c = co(id); if (!st.messages.some((m: Any) => m.company_id === id && m.status === "drafted")) draft(id, "cold", `${c.name} x ${st.event.name}`, offerBody(c, primary(id))); return { ok: true }; }
    case "edit": { const m = msg(b.key); if (m) { m.subject = b.subject; m.body = b.body; } return { ok: true }; }
    case "approve": { const m = msg(b.key); if (m) { m.status = "approved"; m.approved_by = who; } return { ok: true }; }
    case "approve_many": return { results: (b.keys || []).map((k: string) => { const m = msg(k); if (m) { m.status = "approved"; m.approved_by = who; } return { key: k, ok: true }; }) };
    case "reject": { const m = msg(b.key); if (m) m.status = "rejected"; return { ok: true }; }
    case "send": {
      const due = st.messages.filter((m: Any) => m.status === "approved");
      due.forEach((m: Any) => {
        m.status = "sent"; m.sent_at = now(); m.attempts = 1;
        if (m.sequence === "cold" && ["PROSPECT", "QUALIFIED", "CONTACT_READY"].includes(co(m.company_id)?.stage)) stage(m.company_id, "CONTACTED");
        log("Email", m.company_id, "send", `Marked as sent (demo only): ${m.subject}`);
      });
      return { ok: true, sent: due.length, notes: ["Demo mode: nothing was really emailed."] };
    }
    case "delivery": { const m = msg(b.key); if (m) m.status = b.outcome === "sent" ? "sent" : "approved"; return { ok: true }; }
    case "replies": return { ok: true, checked: st.messages.filter((m: Any) => m.status === "sent").length, new: 0 };
    case "reconcile": return { ok: true };
    case "simulate": {
      const text = String(b.text || ""), classification = classify(text), offer = amountIn(text), ct = primary(id);
      st.replies.unshift({ id: rid("r"), gmail_id: rid("g"), contact_id: ct?.id, company_id: id, received_at: now(), classification, summary: text.slice(0, 160), offer_inr: offer, handled: 0 });
      stage(id, classification === "not_interested" ? "LOST" : "REPLIED");
      st.messages.filter((m: Any) => m.company_id === id && ["drafted", "approved"].includes(m.status) && m.sequence === "cold").forEach((m: Any) => { m.status = "cancelled"; m.cancel_reason = "reply received"; });
      if (offer != null && offer < st.event.floor_inr) {
        st.exceptions.unshift({ id: rid("x"), company_id: id, kind: "below_floor", question: `${co(id)?.name} offered ${inr(offer)}, below your floor of ${inr(st.event.floor_inr)}.`, recommendation: "Hold the price and ask for in-kind value instead of discounting.", draft_subject: `Re: ${co(id)?.name} x ${st.event.name}`, draft_body: `Hi ${ct?.full_name.split(" ")[0]},\n\nThanks for the offer. We cannot go below ${inr(st.event.floor_inr)}, but we can trade value if you can add in-kind support.\n\nDemo Manager`, status: "open", created_at: now() });
      }
      log("A2", id, "simulate", `Simulated reply read as "${classification}"`);
      return { result: { classification, offer_inr: offer } };
    }
    case "resolve": {
      const x = st.exceptions.find((e: Any) => e.id === b.id);
      if (x) {
        x.status = b.action === "approve" ? "approved" : "rejected"; x.resolved_at = now();
        if (b.action === "approve" && (b.body || x.draft_body)) draft(x.company_id, "reply", b.subject || x.draft_subject, b.body || x.draft_body);
        log(who, x.company_id, "resolve", `Decision ${x.status}`);
      }
      return { ok: true };
    }
    case "schedule": { const c = co(id); draft(id, "meeting", `Quick call about ${st.event.name}?`, `Hi ${primary(id)?.full_name.split(" ")[0]},\n\nDo any of these work?\n\n${(b.slots || []).join("\n")}\n\nDemo Manager`); stage(id, "MEETING_REQUESTED"); log("A3", id, "schedule", `Drafted a scheduling email for ${c?.name}`); return { ok: true }; }
    case "confirm_meeting": {
      const n = st.meetings.filter((m: Any) => m.company_id === id).length + 1;
      st.meetings.unshift({ id: rid("mt"), company_id: id, n, start_at: new Date(b.start).toISOString(), minutes: Number(b.minutes || 30), meet_link: "https://meet.example/demo", status: "scheduled", notes: "", digest: null, created_at: now() });
      stage(id, "MEETING_SCHEDULED"); log("A3", id, "meeting", "Meeting booked (demo only: no invite went out)");
      return { ok: true };
    }
    case "deck": {
      const did = /^(custom)$/.test(id) || !isPrebuilt(id) ? "deck-custom" : `deck-${id}`;
      st.decks = st.decks.filter((d: Any) => d.company_id !== id);
      st.decks.unshift({ id: did, company_id: id, created_at: now() });
      log("A4", id, "deck", `Built the pitch deck for ${co(id)?.name}`);
      return { ok: true, id: did };
    }
    case "gemini_notes": return { text: "Sample notes: they liked the activation idea, budget is around ₹2 lakh, need a decision by month end, asked for past engagement numbers." };
    case "notes": {
      const m = st.meetings.find((x: Any) => x.company_id === id);
      const digest = { temperature: "warm", summary: `Sample digest: ${String(b.notes).slice(0, 180)}` };
      if (m) { m.digest = digest; m.notes = b.notes; m.status = "done"; }
      else st.meetings.unshift({ id: rid("mt"), company_id: id, n: 1, start_at: now(), minutes: 30, meet_link: "", status: "done", notes: b.notes, digest, created_at: now() });
      stage(id, "MEETING_DONE"); draft(id, "recap", `Recap: ${co(id)?.name} x ${st.event.name}`, `Hi ${primary(id)?.full_name.split(" ")[0]},\n\nThanks for your time today. Here is what we agreed:\n\n${String(b.notes).slice(0, 400)}\n\nDemo Manager`);
      log("A5", id, "notes", "Digested the meeting and drafted the recap");
      return { ok: true };
    }
    case "mou": {
      const d = b.deal || {}, shareId = isPrebuilt(id) ? `mou-${id}` : "mou-custom";
      st.deals = st.deals.filter((x: Any) => x.company_id !== id);
      st.deals.push({ company_id: id, tier: d.tier, cash_inr: Number(d.cash_inr || 0), in_kind: d.in_kind || "", deliverables: d.deliverables || "", status: "drafted", share_id: shareId, mou: "", updated_at: now() });
      stage(id, "MOU_DRAFTED"); log("A6", id, "mou", `Drafted the ${d.tier} MOU`);
      return { ok: true };
    }
    case "send_mou": draft(id, "mou", `MOU for signature: ${co(id)?.name} x ${st.event.name}`, `Hi ${primary(id)?.full_name.split(" ")[0]},\n\nThe MOU is ready for your review and signature.\n\nDemo Manager`); return { ok: true };
    case "nurture": st.companies.filter((c: Any) => ["MOU_SIGNED", "PAID", "NURTURE"].includes(c.stage)).forEach((c: Any) => draft(c.id, "nurture", `Update from ${st.event.name}`, `Hi,\n\n${String(b.news || "")}\n\nDemo Manager`)); return { ok: true };
    case "stage": stage(id, String(b.stage)); return { ok: true };
    case "settings": for (const k of ["cap_new_per_day", "cap_total_per_day", "spacing_sec"]) if (b[k] !== undefined) st.settings[k] = String(b[k]); if (b.organiser_permission !== undefined) st.settings.permission = String(b.organiser_permission); return { ok: true };
    case "reset": s = initialState(); return { ok: true };
    case "suppress": return { ok: true };
    case "forget": return { erased: 0 };
    case "google_disconnect": st.settings.gmail = ""; return { ok: true };
    case "user_add": st.users.push({ id: rid("u"), email: String(b.email || ""), name: String(b.name || ""), role: String(b.role || "operator"), disabled: 0, created_at: now() }); return { ok: true };
    case "user_update": { const u = st.users.find((x: Any) => x.id === b.id); if (u) { if (b.role) u.role = b.role; if (b.disabled !== undefined) u.disabled = b.disabled ? 1 : 0; } return { ok: true }; }
    case "sessions_revoke": return { ok: true };
  }
  throw new Error("unknown op " + b.op);
}
function isPrebuilt(id: string) { return initialIds.has(id); }
const initialIds = new Set<string>([...initialState().companies.map((c: Any) => c.id), ...RESERVE.map(([n]) => slug(n))]);

function buildDeck(id: string, team: boolean) {
  const st = state(), cid = id.replace(/^deck-/, ""), c = co(cid) || st.companies.find((x: Any) => st.decks.some((d: Any) => d.id === id && d.company_id === x.id)) || { name: "Your brand", tier: "Gold", angle: "A tracked student activation at the fest." };
  if (!c.tier) { c.tier = "Gold"; c.angle = c.angle || "A tracked student activation at the fest."; }
  const e = st.event, tiers = e.tiers.slice(1);
  const slides: Any[] = [
    { kind: "cover", heading: `Reaching students with ${c.name}`, body: [c.angle], notes: "Open with their goal, not our event." },
    { kind: "goal", heading: "What you are trying to do", body: [`${c.why_now || "You are growing"}.`, "Students are the next customers to win."], notes: "Confirm this before going further." },
    { kind: "audience", heading: "Who you reach", body: [e.audience, "Three days of attention on one campus."], stat: "12,000", stat_label: "students expected" },
    { kind: "idea", heading: "The idea", body: [c.angle] },
    { kind: "deliverables", heading: "What you get", body: String(e.tiers.find((t: Any) => t.name === c.tier)?.deliverables || e.tiers[2].deliverables).split(", ").map((d: string, i: number) => `Item ${i + 1}: ${d}`) },
    { kind: "measurement", heading: "How it is measured", body: ["Offer code redemptions", "QR scans at the activation", "A results report within 10 days"] },
    { kind: "proof", heading: "Proof", body: e.proof_items.map((p: Any) => p.claim) },
    { kind: "options", heading: "Ways to partner", body: tiers.map((t: Any) => `${t.name}: ${lakhs(t.price_inr)}, ${t.deliverables}`) },
    { kind: "timeline", heading: "Timeline", body: ["Week 1: agree the idea", "Week 2: sign the MOU", "Week 4: brand approvals", `${e.dates}: the event`] },
    { kind: "next", heading: "Next step", body: ["A 15 minute call to pick the option that fits."] },
  ];
  const deck: Any = { company: c.name, title: `${c.name} x ${e.name}`, thesis: c.angle, event: { name: e.name, dates: e.dates, city: e.city, organizer: e.organizer }, slides, one_pager: { headline: `${c.name} at ${e.name}`, bullets: [e.audience, c.angle, "Results report within 10 days"], ask: "A 15 minute call this week" } };
  if (team) deck.talk_track = { opening: "Thank them for the time and restate their goal.", discovery: ["What does a good campus result look like for you?", "Who else signs off on this?"], pitch: c.angle, objections: [{ they: "We have no budget this quarter.", we: "Offer a smaller trial tied to a measured result." }], close: "Agree the next step and a date." };
  else slides.forEach((x) => delete x.notes);
  return deck;
}
function buildMou(id: string) {
  const st = state(), cid = id.replace(/^mou-/, ""), deal = st.deals.find((d: Any) => d.share_id === id), c = co(deal?.company_id || cid);
  const tier = deal?.tier || "Gold", cash = deal?.cash_inr ?? 150000, what = deal?.deliverables || st.event.tiers[2].deliverables;
  return { company: c?.name || "Your brand", tier, mou_pdf: null, mou: `# Memorandum of Understanding\n\n**SAMPLE ONLY. Not a real agreement.**\n\nBetween **${st.event.organizer}** and **${c?.name || "Your brand"}** for ${st.event.name}, ${st.event.dates}, ${st.event.city}.\n\n## Partnership\n\n| Item | Detail |\n|---|---|\n| Tier | ${tier} |\n| Cash | ${inr(cash)} |\n| In-kind | ${deal?.in_kind || "None"} |\n\n## Deliverables\n\n${String(what).split(", ").map((d) => `- ${d}`).join("\n")}\n\n## Payment\n\n1. 50% on signature\n2. 50% before the event\n\n## Signatures\n\nFor the organiser: ____________________\n\nFor the sponsor: ____________________` };
}
function assist(q: string) {
  const st = state(), t = q.toLowerCase();
  const drafts = st.messages.filter((m: Any) => m.status === "drafted").length, open = st.exceptions.filter((x: Any) => x.status === "open").length;
  const suggestions = ["What needs me?", "What is the floor?", "Who should I contact first?"];
  const c = st.companies.find((x: Any) => t.includes(x.name.toLowerCase()) || t.includes(x.name.split(" ")[0].toLowerCase()));
  if (c) {
    const p = primary(c.id);
    return { reply: `**${c.name}** is a sample company at stage ${c.stage}. ${c.intersection != null ? `Fit is **${c.intersection}/100** (${c.priority}). ` : "It is not scored yet. "}${c.angle || ""}${p ? ` The decision maker is ${p.full_name}, ${p.position}.` : ""}`, actions: [{ label: `Open ${c.name}`, open: c.id }], suggestions, engine: "rules" };
  }
  if (/floor/.test(t)) return { reply: `The **floor** is the smallest cash deal the agents may accept on their own. Here it is **${inr(st.event.floor_inr)}**. It is never shown to sponsors.`, actions: [{ label: "Event brief", href: "/desk/brief" }], suggestions, engine: "rules" };
  if (/contact|first|who/.test(t)) {
    const top = [...st.companies].filter((x: Any) => x.intersection != null && !["MOU_SIGNED", "LOST"].includes(x.stage)).sort((a: Any, b: Any) => b.intersection - a.intersection)[0];
    return { reply: top ? `Start with **${top.name}**: fit ${top.intersection}/100. ${top.angle}` : "Run the autopilot to find sponsors first.", actions: top ? [{ label: `Open ${top.name}`, open: top.id }] : [], suggestions, engine: "rules" };
  }
  return { reply: `This is the **demo desk** with sample data. There are **${st.companies.length} companies**, **${drafts} drafts** waiting for approval and **${open} decisions** only you can make. Nothing here is real and no email is ever sent.`, actions: [{ label: "Open Outbox", href: "/desk/outbox" }, { label: "Open Inbox", href: "/desk/inbox" }], suggestions, engine: "rules" };
}

/** Answers one /api request. Mirrors the status codes and JSON shapes of the real routes. */
export async function handle(url: string, body: Any): Promise<{ status: number; json: Any }> {
  await new Promise((r) => setTimeout(r, 200));
  const u = new URL(url, "https://demo.local"), path = u.pathname.replace(/^.*\/api\//, "/api/");
  try {
    if (path === "/api/state") {
      const st = state();
      return { status: 200, json: u.searchParams.get("log_only") ? { log: st.log } : JSON.parse(JSON.stringify(st)) };
    }
    if (path === "/api/deck") return { status: 200, json: buildDeck(u.searchParams.get("id") || "", true) };
    if (path === "/api/public") return { status: 200, json: u.searchParams.get("kind") === "mou" ? buildMou(u.searchParams.get("id") || "") : buildDeck(u.searchParams.get("id") || "", false) };
    if (path === "/api/health") return { status: 200, json: { database: { ok: true, detail: "Demo: stored in this browser", ms: 1 }, engine: { ok: true, detail: "Demo rules" }, crustdata: { ok: true, detail: "Demo: sample data, no live calls", ms: 1 }, gmail: { ok: true, detail: "Demo: nothing is sent" } } };
    if (path === "/api/login" || path === "/api/logout") return { status: 200, json: { ok: true } };
    if (path === "/api/assist") return { status: 200, json: assist(String(body?.message || "")) };
    if (path === "/api/event") { state().event = body.profile; save(); return { status: 200, json: { ok: true } }; }
    if (path === "/api/act") { const r = act(body || {}); save(); return { status: 200, json: r ?? { ok: true } }; }
    return { status: 404, json: { error: "Not available in the demo" } };
  } catch (e: Any) { return { status: 400, json: { error: e?.message || String(e) } }; }
}
