// Desk assistant: answers "what is going on?" and any how-to question from the desk's own live state.
// Works with no AI key (intent rules over real data). With a FREE Gemini key (GEMINI_API_KEY from aistudio.google.com)
// it rephrases the same facts more conversationally, and never invents numbers: it only sees the facts below.
import { db, json, getSetting } from "./db";
import { hasCrustdata } from "./crustdata";
import { fromEnglish, toEnglish } from "./sarvam";
import { categoryById } from "./sponsor-categories";

export type AssistAction = { label: string; href?: string; open?: string };
export type AssistReply = { reply: string; actions: AssistAction[]; suggestions: string[]; engine: "rules" | "gemini" | "sarvam"; lang?: string };

const STAGE: Record<string, string> = {
  PROSPECT: "found, not scored yet", QUALIFIED: "scored", CONTACT_READY: "contact found", CONTACTED: "offer sent", FOLLOWUP_1: "follow-up 1 sent", FOLLOWUP_2: "follow-up 2 sent",
  REPLIED: "replied", MEETING_REQUESTED: "meeting asked", MEETING_SCHEDULED: "meeting booked", MEETING_DONE: "met", NEGOTIATING: "negotiating", MOU_DRAFTED: "MOU drafted",
  MOU_SENT: "MOU sent", MOU_SIGNED: "MOU signed", PAID: "paid", DISQUALIFIED: "dropped", OPTED_OUT: "opted out", BOUNCED: "bounced", LOST: "lost",
};
const AGENTS: Record<string, [string, string]> = {
  A0: ["Package", "turns your one-line brief into an event package: audience, proof, past sponsors, four priced tiers and a floor price."],
  A1: ["Prospect", "finds companies with fresh budget signals on Crustdata and scores each from your side and theirs."],
  A2: ["Outreach", "finds the right decision maker, checks their email, writes the priced offer and handles follow-ups and replies."],
  A3: ["Schedule", "drafts meeting emails and books Google Meet calls when a sponsor wants to talk."],
  A4: ["Pitch", "builds a 10-slide deck about that company's goals, with a talk track for your team."],
  A5: ["Negotiate", "reads meeting notes, drafts the recap, and counters offers below your floor with trades instead of discounts."],
  A6: ["Close", "drafts the MOU from the deal sheet and emails it for signature."],
  A7: ["Nurture", "writes fortnightly updates to signed sponsors from your team's news."],
};
const GLOSSARY: [RegExp, string][] = [
  [/\bfloor\b/, "The **floor** is the smallest cash deal the agents may accept on their own. Below it, the offer comes to your Inbox with a trade-based counter. It is never shown to sponsors."],
  [/\bp1\b|\bp2\b|\bp3\b|priority/, "**Priority** is the lower of two scores. **P1** means both are 70 or more, **P2** 50 or more, **P3** 35 or more. Below 35 the company is dropped. Using the lower score stops a rich brand with no audience fit from jumping the queue."],
  [/\bfit\b|intersection|ours|theirs|score/, "Every company gets two scores out of 100. **Ours**: can they pay, do they fit the brand, how likely to close. **Theirs**: does your audience match their customers, do they have a live goal, can they measure results. The fit shown on cards is the lower of the two."],
  [/\btier/, "**Tiers** are the four packages you sell: Title, Platinum, Gold and Silver. With a goal set, they are sized so 1 Title, 2 Platinum, 4 Gold and 6 Silver deals reach it. Edit them on the Event brief page before locking the floor."],
  [/verified|unverified|corroborated|deliverable/, "**Verified** means Crustdata confirmed the work email is deliverable and it sits on the company's own domain. **Unverified** emails go to Decision makers for a person to check. The desk never guesses an email."],
  [/credit|crustdata|cost|price of/, "Crustdata provides the company and people data; Sarvam, if connected, adds voice and Indian languages on its own usage bill. A fully researched sponsor costs about **10 credits**: 2 for company data, about 3 for the people search and 4 for two business emails. The event brief costs 1 or 2. Credits are charged only when data comes back."],
  [/draft mode|gmail|send/, "Without Gmail connected the desk runs in **draft mode**: approved emails wait in the Outbox. Connect Google in Settings to send from your own mailbox. Nothing is ever sent without a named approver."],
  [/caution|negative|risk/, "**Caution** signals are recent news a person should read before pitching, such as a regulator settlement. Two or more distress headlines, or a big headcount drop, drop the company automatically."],
];
const HOWTO: [RegExp, string, AssistAction[]][] = [
  [/add (a )?(company|sponsor|brand)|specific (company|brand)/, "Open **Companies**, type the brand and its website in *Add a company*, and press *Add and score*. Or name brands in the Event brief under *Brands you have in mind*: the desk adds them before searching.", [{ label: "Open Companies", href: "/desk/companies" }]],
  [/category|categories|kind of sponsor|type of sponsor|which sponsors/, "Choose sponsor categories on the **Event brief** page (for example Food and beverages, Fintech, Sportswear). Discovery then searches only those industries. Leave them empty and the desk picks industries that fit your event type.", [{ label: "Open Event brief", href: "/desk/brief" }]],
  [/lock|floor price/, "On the **Event brief** page check the tiers, set the floor and press *Lock floor*. Discovery starts only after the floor is locked.", [{ label: "Open Event brief", href: "/desk/brief" }]],
  [/connect|google|gmail|calendar/, "Go to **Settings** and press *Connect Google*. An admin needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in Vercel first.", [{ label: "Open Settings", href: "/desk/settings" }]],
  [/approve|send (the )?email|outbox/, "Open the **Outbox**, read each draft, then *Approve* or *Edit*. *Send approved now* sends them (or they wait in draft mode without Gmail).", [{ label: "Open Outbox", href: "/desk/outbox" }]],
  [/team|teammate|user|invite|role/, "In **Settings** an admin adds people with a role: admin, approver, operator or read-only. Only approvers can approve emails or lock the floor.", [{ label: "Open Settings", href: "/desk/settings" }]],
  [/meeting|call|meet/, "Open a company, go to *Next steps* and use *Book a meeting*: draft the scheduling email, then confirm the time to send a Google Meet invite.", [{ label: "Open Pipeline", href: "/desk/pipeline" }]],
  [/deck|pitch/, "Open a company and press *Build deck* under Pitch. You get a shareable 10-slide deck and a talk track for your team.", []],
  [/mou|contract|agreement/, "Open a company, fill the deal sheet under *MOU* and press *Draft MOU*. Below-floor amounts go to your Inbox first.", []],
  [/export|csv|download/, "Use *Export CSV* on the **People** page to download every contact with sources.", [{ label: "Open People", href: "/desk/people" }]],
  [/start|begin|first|brief|prompt|what should i (type|write|enter)/, "Start on the **Event brief** page. Give the event name and year, organiser, dates, city, expected footfall, who attends, your goal in rupees and the postal address. The meter shows what is missing. Then pick the sponsor categories you want, or skip.", [{ label: "Open Event brief", href: "/desk/brief" }]],
  [/reset|start over|clear/, "Settings has *Reset desk*, which clears companies, emails and the brief. Settings and the Google connection stay. You must type RESET to confirm.", [{ label: "Open Settings", href: "/desk/settings" }]],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").replace(/\s+/g, " ").trim();
const inr = (n: number) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)} crore` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} lakh` : `₹${Math.round(n).toLocaleString("en-IN")}`);

async function load() {
  const d = await db();
  const ev = await d.q(`SELECT profile FROM events WHERE id='current'`);
  const event = ev[0] ? json<any>(ev[0].profile, null) : null;
  const companies = (await d.q(`SELECT * FROM companies`)).map((c: any) => ({ ...c, reasons: json<any>(c.reasons, {}) }));
  const contacts = await d.q(`SELECT * FROM contacts WHERE status <> 'erased'`);
  const messages = await d.q(`SELECT key, company_id, status, sequence, step, subject, to_email, created_at FROM messages`);
  const exceptions = await d.q(`SELECT * FROM exceptions WHERE status='open' ORDER BY created_at DESC`);
  const log = await d.q(`SELECT * FROM log ORDER BY ts DESC LIMIT 12`);
  const deals = await d.q(`SELECT company_id, cash_inr, tier, status FROM deals`);
  return { event, companies, contacts, messages, exceptions, log, deals, gmail: await getSetting("gmail_email", ""), permission: await getSetting("organiser_permission", "") };
}
type S = Awaited<ReturnType<typeof load>>;

function brandOf(c: any) { return String(c.reasons?.about?.brand || c.name).replace(/\b(pvt\.?|private|ltd\.?|limited|international|enterprises)\b/gi, "").replace(/\(.*?\)/g, "").trim(); }
function findCompany(s: S, q: string) {
  const t = ` ${norm(q)} `;
  let best: any = null, bestLen = 0;
  for (const c of s.companies) {
    for (const cand of [c.name, brandOf(c), c.domain?.split(".")[0]]) {
      const n = norm(String(cand || ""));
      if (n.length >= 3 && t.includes(` ${n} `) && n.length > bestLen) { best = c; bestLen = n.length; }
      const firstWord = n.split(" ")[0];
      if (!best && firstWord.length >= 4 && t.includes(` ${firstWord} `)) { best = c; bestLen = firstWord.length; }
    }
  }
  return best;
}
const primaryOf = (s: S, id: string) => s.contacts.find((x: any) => x.company_id === id && x.is_primary) || s.contacts.find((x: any) => x.company_id === id);

function nextSteps(s: S): { text: string; action?: AssistAction }[] {
  const out: { text: string; action?: AssistAction }[] = [];
  if (!s.event) return [{ text: "Write your event brief: name, organiser, dates, footfall, audience and goal.", action: { label: "Write the brief", href: "/desk/brief" } }];
  if (!s.event.floor_locked) out.push({ text: `Check the tiers and lock the floor (suggested ${inr(s.event.floor_inr || 0)}). Discovery waits for this.`, action: { label: "Lock the floor", href: "/desk/brief" } });
  const drafts = s.messages.filter((m: any) => m.status === "drafted");
  if (drafts.length) out.push({ text: `Approve or edit ${drafts.length} drafted email${drafts.length > 1 ? "s" : ""} in the Outbox.`, action: { label: "Open Outbox", href: "/desk/outbox" } });
  if (s.exceptions.length) out.push({ text: `Decide ${s.exceptions.length} item${s.exceptions.length > 1 ? "s" : ""} only a person can decide.`, action: { label: "Open Inbox", href: "/desk/inbox" } });
  const unscored = s.companies.filter((c: any) => c.stage === "PROSPECT").length;
  if (unscored) out.push({ text: `Score ${unscored} found compan${unscored > 1 ? "ies" : "y"}: run the autopilot again.`, action: { label: "Open Dashboard", href: "/desk" } });
  if (s.event.floor_locked && !s.companies.length) out.push({ text: "Run the autopilot to find sponsors.", action: { label: "Open Dashboard", href: "/desk" } });
  if (drafts.length && !s.permission) out.push({ text: "Record the organisers' written permission in Settings, or cold emails stay on hold.", action: { label: "Open Settings", href: "/desk/settings" } });
  if (!s.gmail && s.messages.some((m: any) => m.status === "approved")) out.push({ text: "Connect Gmail in Settings so approved emails can go out.", action: { label: "Open Settings", href: "/desk/settings" } });
  if (!out.length) out.push({ text: "Nothing is waiting on you. Run the autopilot for more sponsors, or follow up on meetings." });
  return out;
}

function statusAnswer(s: S): AssistReply {
  if (!s.event) return { reply: "The desk is empty: no event yet.\n\nStart with the **Event brief**: describe the event and the desk packages it, prices four tiers and suggests a floor.", actions: [{ label: "Write the brief", href: "/desk/brief" }], suggestions: ["What should I type in the brief?", "How much does it cost?"], engine: "rules" };
  const by = (st: string[]) => s.companies.filter((c: any) => st.includes(c.stage)).length;
  const scored = s.companies.filter((c: any) => c.intersection != null && c.stage !== "DISQUALIFIED");
  const p1 = scored.filter((c: any) => c.priority === "P1").length, p2 = scored.filter((c: any) => c.priority === "P2").length;
  const drafts = s.messages.filter((m: any) => m.status === "drafted").length, sent = s.messages.filter((m: any) => m.status === "sent").length;
  const last = s.log.filter((l: any) => !["stage", "queue"].includes(l.action)).slice(0, 3).map((l: any) => { const t = String(l.detail || l.action); return `- ${l.actor}: ${t.length > 120 ? t.slice(0, t.lastIndexOf(" ", 120)) + "…" : t}`; }).join("\n");
  const lines = [
    `**${s.event.name}**${s.event.floor_locked ? `, floor locked at ${inr(s.event.floor_inr)}` : ", floor not locked yet"}.`,
    s.companies.length ? `The desk has **${s.companies.length} companies**: ${p1} P1 and ${p2} P2 scored, ${by(["PROSPECT"])} waiting to be scored, ${by(["DISQUALIFIED"])} dropped.` : "No companies yet.",
    `Emails: **${drafts} waiting for your approval**, ${sent} sent.${s.exceptions.length ? ` **${s.exceptions.length} decisions** need you in the Inbox.` : ""}`,
    last ? `Latest agent activity:\n${last}` : "",
    `**Next:** ${nextSteps(s)[0].text}`,
  ].filter(Boolean);
  const top = scored.sort((a: any, b: any) => (b.intersection || 0) - (a.intersection || 0))[0];
  return { reply: lines.join("\n\n"), actions: nextSteps(s).map((x) => x.action).filter(Boolean).slice(0, 3) as AssistAction[], suggestions: [drafts ? "What's waiting for my approval?" : "What should I do next?", top ? `Why is ${brandOf(top)} a ${top.priority}?` : "How do I find sponsors?", "Who should I pitch first?"], engine: "rules" };
}

function companyAnswer(s: S, c: any, q: string): AssistReply {
  const r = c.reasons || {};
  const ab = r.about || {};
  const ct = primaryOf(s, c.id);
  const drafts = s.messages.filter((m: any) => m.company_id === c.id && m.status === "drafted").length;
  const name = brandOf(c);
  const acts: AssistAction[] = [{ label: `Open ${name}`, open: c.id }];
  if (/\bwho\b|contact|email|person|reach|decision/.test(q)) {
    if (!ct) return { reply: `No decision maker found at **${name}** yet. Score the company, or add a contact by hand.`, actions: acts, suggestions: [`Why is ${name} a fit?`], engine: "rules" };
    return { reply: `At **${name}**, the desk picked **${ct.full_name}**, ${ct.position}.\n\nEmail: ${ct.email ? `${ct.email} (${String(ct.email_status).toLowerCase()})` : "none found yet"}. Relevance ${ct.relevance ?? "?"}/100.${ct.reason ? `\n\nWhy them: ${ct.reason}.` : ""}`, actions: acts, suggestions: [`Why is ${name} a fit?`, "What's waiting for my approval?"], engine: "rules" };
  }
  const why = (r.why_fit || []).map((x: string) => `- ${x}`).join("\n");
  const watch = (r.watch_outs || []).map((x: string) => `- ${x}`).join("\n");
  const scores = c.our_pov != null ? `Scores: ours **${c.our_pov}**, theirs **${c.their_pov}**, so **${c.priority}**.` : "Not scored yet.";
  const reply = [
    `**${c.name}**${ab.industry ? ` · ${ab.industry}` : ""}${ab.headcount ? ` · ${Number(ab.headcount).toLocaleString("en-IN")} people` : ""}`,
    ab.description ? `${ab.description}` : "",
    scores,
    why ? `Why it fits:\n${why}` : "",
    watch ? `Watch out:\n${watch}` : "",
    `Stage: ${STAGE[c.stage] || c.stage}.${c.price_range ? ` Offer: ${c.price_range}.` : ""}${ct ? ` Contact: ${ct.full_name}${ct.email ? ` (${String(ct.email_status).toLowerCase()} email)` : " (no email yet)"}.` : ""}${drafts ? ` ${drafts} email waiting for approval.` : ""}`,
  ].filter(Boolean).join("\n\n");
  return { reply, actions: drafts ? [...acts, { label: "Open Outbox", href: "/desk/outbox" }] : acts, suggestions: [`Who should I contact at ${name}?`, "Who should I pitch first?"], engine: "rules" };
}

export async function answer(message: string, _path = ""): Promise<AssistReply> {
  const s = await load();
  const q = norm(message);
  const R = (reply: string, actions: AssistAction[] = [], suggestions: string[] = []): AssistReply => ({ reply, actions, suggestions: suggestions.length ? suggestions : defaultSuggestions(s), engine: "rules" });
  if (!q) return R("Ask me anything about the desk: what is going on, why a company was picked, or how to do something.");
  if (/^(hi|hello|hey|yo|namaste|hii+|good (morning|evening|afternoon))\b/.test(q) && q.split(" ").length <= 4) {
    const st = statusAnswer(s);
    return { ...st, reply: `Hi! I'm the desk assistant. I watch the agents and can explain anything on screen.\n\n${st.reply}` };
  }
  const co = findCompany(s, message);
  if (co && !/^(how|what is|what are)\b/.test(q)) return companyAnswer(s, co, q);
  for (const [id, [nm, job]] of Object.entries(AGENTS)) if (new RegExp(`\\b${id.toLowerCase()}\\b|\\b${nm.toLowerCase()} agent\\b`).test(q)) {
    const last = s.log.find((l: any) => l.actor === id);
    return R(`**${id} · ${nm}** ${job}${last ? `\n\nLast action: ${String(last.detail || last.action).slice(0, 140)}.` : ""}`, [{ label: "See all agents", href: "/desk/agents" }], ["What are all the agents?", "What's going on?"]);
  }
  if (/\bagents?\b|who does what|how does (it|this|the desk) work/.test(q)) return R("Eight agents pass the work along:\n\n" + Object.entries(AGENTS).map(([id, [n, j]]) => `- **${id} ${n}**: ${j}`).join("\n") + "\n\nThey ask a person only when it matters: approving emails, locking the floor and anything below it.", [{ label: "See the agent flow", href: "/desk/agents" }]);
  if (/what (s|is) (going on|happening)|status|progress|update|where are we|summary|overview|explain|confus|what (is|are) (the )?(desk|agents?) doing|whats up/.test(q)) return statusAnswer(s);
  if (/next|what (should|do|can) i do|to ?do|pending|stuck|todo|what now/.test(q)) {
    const n = nextSteps(s);
    return R("Here is what to do, in order:\n\n" + n.map((x, i) => `${i + 1}. ${x.text}`).join("\n"), n.map((x) => x.action).filter(Boolean).slice(0, 3) as AssistAction[]);
  }
  if (/pitch first|best (compan|sponsor)|top (compan|sponsor|target)|priority list|who (should|to) (i )?(pitch|target|contact) first/.test(q)) {
    const top = s.companies.filter((c: any) => c.intersection != null && c.stage !== "DISQUALIFIED").sort((a: any, b: any) => (b.intersection || 0) - (a.intersection || 0)).slice(0, 5);
    if (!top.length) return R("Nothing is scored yet. Run the autopilot from the Dashboard first.", [{ label: "Open Dashboard", href: "/desk" }]);
    return R("Pitch in this order (highest fit first):\n\n" + top.map((c: any, i: number) => { const ct = primaryOf(s, c.id); return `${i + 1}. **${brandOf(c)}** (${c.priority}, fit ${c.intersection})${ct?.email_status === "VERIFIED" ? ", verified contact" : ct ? ", contact needs a check" : ", no contact yet"}`; }).join("\n"), [{ label: "Open Companies", href: "/desk/companies" }], top.slice(0, 2).map((c: any) => `Why is ${brandOf(c)} a fit?`));
  }
  if (/approv|outbox|draft|waiting|emails?\b/.test(q)) {
    const d = s.messages.filter((m: any) => m.status === "drafted");
    if (!d.length) return R("Nothing is waiting for approval right now.", [{ label: "Open Outbox", href: "/desk/outbox" }]);
    const name = (id: string) => brandOf(s.companies.find((c: any) => c.id === id) || { name: id });
    return R(`**${d.length} email${d.length > 1 ? "s" : ""}** waiting for a named approver:\n\n${d.slice(0, 8).map((m: any) => `- ${name(m.company_id)}: "${m.subject}" to ${m.to_email}`).join("\n")}${s.gmail ? "" : "\n\nGmail is not connected, so approved emails stay in draft mode."}`, [{ label: "Review in Outbox", href: "/desk/outbox" }]);
  }
  if (/inbox|decision|exception|decide|needs? me|attention|problem|issue/.test(q)) {
    if (!s.exceptions.length) return R("Nothing needs your decision right now.", [{ label: "Open Inbox", href: "/desk/inbox" }]);
    return R(`**${s.exceptions.length} decision${s.exceptions.length > 1 ? "s" : ""}** for you:\n\n${s.exceptions.slice(0, 6).map((x: any) => `- ${String(x.question).slice(0, 150)}`).join("\n")}`, [{ label: "Open Inbox", href: "/desk/inbox" }]);
  }
  if (/how many|count|total/.test(q)) return statusAnswer(s);
  if (/\b(cost|costs|credit|credits|crustdata|expensive|charge|pay for|free)\b/.test(q)) return R(GLOSSARY.find(([rx]) => rx.test("credit"))![1], [{ label: "Check credits in Settings", href: "/desk/settings" }], ["What's going on?", "Who should I pitch first?"]);
  if (/goal|target|how much|money|pipeline value|raised|revenue/.test(q) && s.event) {
    const won = s.deals.reduce((t: number, x: any) => t + Number(x.cash_inr || 0), 0);
    return R(`Goal: **${inr(s.event.goal_inr || 0)}**. In drafted MOUs: **${inr(won)}**.\n\nTiers: ${(s.event.tiers || []).map((t: any) => `${t.name} ${inr(t.price_inr)}`).join(", ")}. ${s.event.pricing_basis || ""}`, [{ label: "Open Event brief", href: "/desk/brief" }]);
  }
  if (/looking for|preference|categor/.test(q) && s.event && /what|which|current/.test(q)) {
    const cats = (s.event.sponsor_categories || []).map((id: string) => categoryById(id)?.label || id);
    return R(cats.length ? `The desk is searching: **${cats.join(", ")}**${s.event.wanted_brands?.length ? `, plus brands you asked for: ${s.event.wanted_brands.join(", ")}` : ""}.` : "No categories chosen, so the desk picks industries that fit your event type.", [{ label: "Change on Event brief", href: "/desk/brief" }]);
  }
  for (const [rx, text, acts] of HOWTO) if (rx.test(q) && /how|where|can i|want to|should|add|connect|change|pick|choose|start|type|write/.test(q)) return R(text, acts);
  for (const [rx, text] of GLOSSARY) if (rx.test(q)) return R(text + (/credit|crustdata|cost/.test(q) && hasCrustdata() ? "" : ""), [], ["What's going on?", "What should I do next?"]);
  for (const [rx, text, acts] of HOWTO) if (rx.test(q)) return R(text, acts);
  return R("I'm not sure what you mean yet. I can explain what the agents are doing, why a company was picked, who to contact, what's waiting for you, or how to do something. Try one of these:", [], defaultSuggestions(s));
}

function defaultSuggestions(s: S) {
  const out = ["What's going on?", "What should I do next?"];
  const top = s.companies.filter((c: any) => c.priority === "P1")[0];
  if (top) out.push(`Why is ${brandOf(top)} a P1?`);
  if (!s.event) out.push("What should I type in the brief?");
  else if (!s.event.floor_locked) out.push("What is the floor price?");
  else out.push("Who should I pitch first?");
  return out.slice(0, 4);
}

const PHRASE = "You are the SponsorDesk assistant for event sponsorship teams in India. Rewrite the FACTS as a friendly, short answer to the user's question. Use only the facts: never add numbers, names, companies or promises that are not in them. Keep **bold** markers and bullet lists. Under 140 words. No em dashes.";

async function geminiPhrase(key: string, prompt: string) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, signal: AbortSignal.timeout(9000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PHRASE }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
    }),
  });
  if (!res.ok) return "";
  const j: any = await res.json();
  return (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim() as string;
}

/** Optional: a free Gemini key phrases replies more conversationally; a SARVAM_API_KEY answers in the user's Indian language. Facts stay the same; on any error the rule answer is used. */
export async function assist(message: string, path = "", lang = ""): Promise<AssistReply> {
  const q = await toEnglish(message, lang);
  const base = await answer(q.text, path);
  const key = process.env.GEMINI_API_KEY;
  let phrased = "";
  if (key && message.length <= 600) phrased = await geminiPhrase(key, `QUESTION: ${q.text}\n\nFACTS:\n${base.reply}`).catch(() => "");
  const english = phrased || base.reply;
  const reply = await fromEnglish(english, q.lang);
  return { ...base, reply, engine: reply !== english ? "sarvam" : phrased ? "gemini" : "rules", lang: q.lang };
}
