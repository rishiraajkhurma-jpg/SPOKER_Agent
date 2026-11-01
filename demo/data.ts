// Sample data for the GitHub Pages demo. Every company, person and event here is fictional.
type Any = any;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const EVENT: Any = {
  name: "Horizon Fest 2027",
  one_line: "Horizon Fest 2027, a three-day college techno-cultural festival by the fictional Horizon Institute, Pune, with 12,000 students expected.",
  organizer: "Horizon Institute Student Council (fictional)",
  dates: "12 to 14 February 2027",
  city: "Pune",
  website: "https://horizon-fest.example",
  event_type: "college",
  audience: "12,000 students aged 18 to 24 from 60 colleges across Maharashtra",
  past_sponsors: "Sample brands from the 2026 edition",
  proof: "9,800 attendees in 2026 (sample figure), 1.2 lakh Instagram reach during the fest",
  proof_items: [{ claim: "9,800 attendees in 2026 (sample figure)", verified: true }, { claim: "1.2 lakh Instagram reach during the fest (sample figure)", verified: true }],
  inkind_needs: "Drinks for volunteers, prize vouchers, stage hardware",
  postal_address: "Horizon Institute, Sample Road, Pune 411001",
  sender: { name: "Demo Manager", title: "Head, Sponsorships", org: "Horizon Fest", phone: "" },
  goal_inr: 2500000,
  floor_inr: 80000,
  floor_locked: true,
  pricing_basis: "About INR 40 per attendee for the title slot, scaled for a college event. Sample pricing.",
  sponsor_categories: [],
  wanted_brands: [],
  sources: [{ url: "https://horizon-fest.example/2026-report", title: "Horizon Fest 2026 report (sample)" }],
  tiers: [
    { name: "Title", price_inr: 500000, deliverables: "Naming rights, main stage branding, 2 activation zones, reel series" },
    { name: "Platinum", price_inr: 300000, deliverables: "Co-branding on stage, 1 activation zone, 3 reels" },
    { name: "Gold", price_inr: 150000, deliverables: "Logo on all creatives, stall, 1 reel" },
    { name: "Silver", price_inr: 100000, deliverables: "Logo on website and standees, stall" },
  ],
};

type Seed = [name: string, industry: string, stage: string, ours: number | null, theirs: number | null, tier: string, angle: string, person: string, position: string, why: string];

const SEEDS: Seed[] = [
  ["Northwind Snacks", "Packaged food", "NEGOTIATING", 84, 81, "Platinum", "Sampling booth at the food court so 12,000 students try the new range.", "Asha Verma", "Brand Manager", "Launching a campus range this quarter"],
  ["Bluepeak Pay", "Fintech", "MEETING_SCHEDULED", 82, 78, "Title", "Offer codes on every ticket and stall payment to win first-time student users.", "Rohan Iyer", "Head of Growth", "Raised a funding round 4 months ago"],
  ["Orbitly Cloud", "Developer tools", "REPLIED", 76, 74, "Gold", "A hackathon track with credits for student builders.", "Neha Kulkarni", "Developer Relations Lead", "Hiring 12 campus roles right now"],
  ["Saffron Energy", "Beverages", "CONTACTED", 73, 77, "Gold", "Drinks for athletes and volunteers plus a stage-side bar.", "Kabir Shah", "Marketing Manager", "Headcount up 14% in 6 months"],
  ["Papaya Quick", "Quick commerce", "CONTACT_READY", 79, 72, "Platinum", "Campus delivery offer codes with tracked first orders.", "Ishita Nair", "Campus Marketing Lead", "Expanding to Pune this quarter"],
  ["Trailmix Fitness", "Fitness", "CONTACT_READY", 68, 71, "Silver", "Morning fitness sessions on the sports ground.", "Dev Malhotra", "Partnerships Manager", "Opened 5 new centres this year"],
  ["Inkwell Learn", "Education", "MOU_SIGNED", 80, 83, "Gold", "A case challenge with internship interviews for the winners.", "Tara Menon", "VP Marketing", "Runs a college ambassador programme"],
  ["Cobalt Mobility", "Mobility", "QUALIFIED", 58, 54, "Silver", "Ride credits for fest travel.", "Arjun Bose", "Regional Marketing Head", "New city launch announced"],
  ["Juniper Beauty", "Personal care", "PROSPECT", null, null, "", "", "", "", "Funding round 8 months ago"],
];
export const RESERVE: [string, string, string][] = [
  ["Tangerine Travel", "Travel", "Headcount up 11% in 6 months"],
  ["Quill Careers", "Recruitment", "Funding round 3 months ago"],
  ["Pebble Audio", "Consumer electronics", "New campus line announced"],
  ["Harbor Insure", "Insurance", "Headcount up 9% in 6 months"],
  ["Sunbeam Foods", "Packaged food", "Funding round 6 months ago"],
  ["Lantern Games", "Gaming", "Hiring 8 marketing roles"],
];

export const PEOPLE_FOR_NEW = ["Sana Pillai", "Vikram Joshi", "Leela Rao", "Nikhil Gupta", "Pooja Sen", "Farhan Ali", "Mira Das"];

export function priorityOf(i: number) { return i >= 70 ? "P1" : i >= 50 ? "P2" : i >= 35 ? "P3" : ""; }

export function scored(name: string, industry: string, ours: number, theirs: number, why: string, angle: string) {
  const split = (n: number, a: number, b: number) => [Math.round(n * a), Math.round(n * b), n - Math.round(n * a) - Math.round(n * b)];
  const [o1, o2, o3] = split(ours, 0.4, 0.3), [t1, t2, t3] = split(theirs, 0.4, 0.35);
  return {
    about: { brand: name, description: `${name} is a fictional ${industry.toLowerCase()} company created for this demo.`, industry, headcount: 180 + name.length * 37, founded: 2012 + (name.length % 10), hq: "Bengaluru", funding_total_usd: 8000000 + name.length * 1500000, last_round: "Series B" },
    why_fit: [`Your audience of 18 to 24 year olds matches who ${name} wants to reach.`, why + ", so budget is likely live.", angle],
    watch_outs: theirs < 60 ? ["Weak audience overlap: keep the first ask small."] : [],
    signals: [{ claim: why, source: "Sample data", date: "2026" }],
    our_pov: { factors: [{ factor: "Can they pay", points: o1, max: 40, why: "Sample funding and size signals" }, { factor: "Brand fit", points: o2, max: 30, why: "Safe category for a college event" }, { factor: "Likely to close", points: o3, max: 30, why: "Has sponsored similar events" }] },
    their_pov: { factors: [{ factor: "Audience match", points: t1, max: 40, why: "Students are a target group" }, { factor: "Live goal", points: t2, max: 35, why: why }, { factor: "Can measure it", points: t3, max: 25, why: "Offer codes and QR scans" }] },
  };
}

export function offerBody(c: Any, ct: Any) {
  return `Hi ${ct.full_name.split(" ")[0]},\n\n${c.why_now}, which is why I am writing. ${EVENT.name} brings 12,000 students to ${EVENT.city} on ${EVENT.dates}.\n\n${c.angle}\n\nThe ${c.tier} partnership is ${c.price_range}. Open to a 15 minute call this week?\n\nDemo Manager\nHead, Sponsorships, Horizon Fest\n${EVENT.postal_address}`;
}

export function initialState(): Any {
  const companies: Any[] = [], contacts: Any[] = [], messages: Any[] = [], log: Any[] = [];
  SEEDS.forEach(([name, industry, stage, ours, theirs, tier, angle, person, position, why], i) => {
    const id = slug(name);
    const inter = ours == null ? null : Math.min(ours, theirs as number);
    const t = EVENT.tiers.find((x: Any) => x.name === tier);
    const c: Any = {
      id, name, domain: `${id}.example`, segment: industry, stage, stage_reason: "sample", our_pov: ours, their_pov: theirs, intersection: inter, priority: inter == null ? "" : priorityOf(inter),
      model: ours == null ? "" : "cash_tier", tier, price_range: t ? `₹${t.price_inr / 100000} lakh` : "", angle, audience_benefit: "", why_now: why, sources: [], role_map: {}, updated_at: hoursAgo(i + 1),
      reasons: ours == null ? { about: { brand: name, industry } } : scored(name, industry, ours, theirs as number, why, angle),
    };
    companies.push(c);
    if (person) {
      const ct: Any = {
        id: `ct-${id}`, company_id: id, full_name: person, position, department: "Marketing", email: `${person.split(" ")[0].toLowerCase()}@${id}.example`, email_status: "VERIFIED", phone: "", one_liner: `${position} at ${name}`,
        context: [], evidence: [], relevance: 80 + (i % 15), relevance_parts: [{ factor: "Role matches the budget", points: 50, max: 60, why: "Marketing decision maker" }, { factor: "Seniority", points: 30 + (i % 15), max: 40, why: "Can approve this spend" }],
        email_check: ["format ok", "domain ok"], reason: "Owns campus and brand budgets.", warm_path: "", status: "active", is_primary: 1, kind: "primary", created_at: hoursAgo(30),
      };
      contacts.push(ct);
      const sent = stage !== "CONTACT_READY" && stage !== "QUALIFIED";
      if (stage !== "QUALIFIED") {
        messages.push({ id: `m-${id}`, key: `${id}:cold:0`, contact_id: ct.id, company_id: id, to_email: ct.email, sequence: "cold", step: 0, subject: `${name} x ${EVENT.name}`, body: offerBody(c, ct), gate: "approval", status: sent ? "sent" : "drafted", approved_by: sent ? "Demo Manager" : null, scheduled_for: null, sent_at: sent ? hoursAgo(48 + i) : null, cancel_reason: null, attempts: sent ? 1 : 0, created_at: hoursAgo(50 + i) });
      }
    }
    log.push({ id: `l-${i}`, ts: hoursAgo(i * 3 + 1), actor: ours == null ? "A1" : "A2", company_id: id, action: "sample", from_stage: null, to_stage: stage, detail: ours == null ? `Found ${name}: ${why}` : `Scored ${name} at ${inter}/100` });
  });
  const replies: Any[] = [
    { id: "r1", gmail_id: "g1", contact_id: "ct-northwind-snacks", company_id: "northwind-snacks", received_at: hoursAgo(5), classification: "interested", summary: "Likes the sampling idea but offered less than your floor.", offer_inr: 60000, handled: 0 },
    { id: "r2", gmail_id: "g2", contact_id: "ct-orbitly-cloud", company_id: "orbitly-cloud", received_at: hoursAgo(9), classification: "meeting", summary: "Asked for a call next week.", offer_inr: null, handled: 0 },
  ];
  const exceptions: Any[] = [
    { id: "x1", company_id: "northwind-snacks", kind: "below_floor", question: "Northwind Snacks offered ₹60,000, which is below your floor of ₹80,000. How should the desk respond?", recommendation: "Keep the price and trade value: hold ₹80,000 and ask for snack boxes for 500 volunteers as in-kind.", draft_subject: "Re: Northwind Snacks x Horizon Fest 2027", draft_body: "Hi Asha,\n\nThanks for coming back so quickly. We cannot go below ₹80,000 for the sampling booth, but if Northwind can add snack boxes for our 500 volunteers we can include an extra reel.\n\nDoes that work?\n\nDemo Manager", status: "open", created_at: hoursAgo(5) },
  ];
  const meetings: Any[] = [
    { id: "mt1", company_id: "bluepeak-pay", n: 1, start_at: daysAhead(2), minutes: 30, meet_link: "https://meet.example/demo-bluepeak", status: "scheduled", notes: "", digest: null, created_at: hoursAgo(20) },
  ];
  const deals: Any[] = [
    { company_id: "inkwell-learn", tier: "Gold", cash_inr: 150000, in_kind: "", deliverables: "Logo on all creatives, stall, 1 reel", status: "signed", share_id: "mou-inkwell-learn", mou: "", updated_at: hoursAgo(26) },
  ];
  const decks: Any[] = [{ id: "deck-bluepeak-pay", company_id: "bluepeak-pay", created_at: hoursAgo(18) }];
  return {
    me: { name: "Demo Manager", email: "demo@horizon-fest.example", role: "admin" },
    users: [{ id: "u1", email: "demo@horizon-fest.example", name: "Demo Manager", role: "admin", disabled: 0, created_at: hoursAgo(200) }],
    event: { ...EVENT }, companies, contacts, messages, replies, exceptions, deals, meetings, decks, log,
    settings: { approvers: "Demo Manager", postal: "411001", cap_new_per_day: "30", cap_total_per_day: "60", spacing_sec: "60", gmail: "demo@horizon-fest.example", googleApp: true, crustdata: true, source: "Sample data", engine: "Demo rules, in your browser", permission: "" },
  };
}

// Pre-rendered document pages. Companies added by hand use the "custom" page.
const ALL = [...SEEDS.map((s) => slug(s[0])), ...RESERVE.map((r) => slug(r[0])), "custom"];
export const DECK_IDS = ALL.map((x) => `deck-${x}`);
export const MOU_IDS = ALL.map((x) => `mou-${x}`);
