// Live reading of what an organiser types into the brief composer. Runs in the browser on every keystroke,
// so it is pure and fast. It only guides: the server re-parses everything when the brief is packaged.

export type BriefField = "name" | "organiser" | "dates" | "city" | "footfall" | "audience" | "goal" | "address";
export type FieldInfo = { key: BriefField; label: string; found: string; weight: number; why: string; example: string };

const MONTH = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;
const ORG = /\b(iit|iim|nit|bits|iiit|iisc|xlri|isb|nlu|aiims|iiser|university|college|institute|school|e-?cell|club|society|foundation|association|council|chapter|community|pvt|ltd|llp)\b/i;
const CITIES = ["Mumbai", "Bombay", "Powai", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Chandigarh", "Indore", "Bhopal", "Nagpur", "Surat", "Kochi", "Coimbatore", "Guwahati", "Bhubaneswar", "Patna", "Noida", "Gurugram", "Gurgaon", "Goa", "Mysuru", "Vellore", "Manipal", "Roorkee", "Kharagpur", "Varanasi", "Dehradun", "Visakhapatnam", "Thiruvananthapuram", "Madurai", "Tiruchirappalli", "Trichy", "Ranchi", "Raipur", "Amritsar", "Jodhpur", "Udaipur", "Pilani", "Singapore", "Dubai", "London"];
const AUDIENCE = /\b(students?|founders?|startups?|developers?|engineers?|athletes?|professionals?|delegates?|investors?|creators?|gamers?|runners?|alumni|freshers?|families|kids|women|corporates?|ceos?|cxos?)\b/i;
const COUNT = /(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lac|l)?\s*\+?\s*(footfall|attendees|participants|registrations|visitors|students|delegates|people|athletes|runners)/i;
const GOAL = /(goal|target|raise|budget|looking for|need)\b[^,;\n]*?(?:₹|rs\.?|inr)?\s*(\d[\d,.]*)\s*(k|lakhs?|lacs?|l|crores?|cr)?/i;
const MONEY = /(?:₹|rs\.?|inr)\s*\d[\d,.]*\s*(k|lakhs?|lacs?|l|crores?|cr)?|\d[\d,.]*\s*(lakhs?|lacs?|crores?|cr)\b/i;

export const FIELDS: Omit<FieldInfo, "found">[] = [
  { key: "name", label: "Event name and year", weight: 15, why: "Finds the event's own pages and past sponsors on the web.", example: "Aavhan 2027" },
  { key: "organiser", label: "Organiser", weight: 15, why: "Signs the emails and decides the pricing tier for your institute.", example: "IIT Bombay" },
  { key: "dates", label: "Dates", weight: 10, why: "Sponsors plan budgets by quarter; dates go into every offer.", example: "24 to 26 Jan 2027" },
  { key: "city", label: "City", weight: 8, why: "Brands buy reach in specific cities.", example: "Mumbai" },
  { key: "footfall", label: "Expected footfall", weight: 20, why: "Sets your tier prices and is the first number a sponsor asks for.", example: "15,000 footfall" },
  { key: "audience", label: "Who attends", weight: 12, why: "Decides which industries the desk targets and how the pitch reads.", example: "college athletes and students from 120 colleges" },
  { key: "goal", label: "Sponsorship goal", weight: 12, why: "Sizes the tiers so a realistic mix of sponsors reaches it.", example: "goal ₹50 lakh" },
  { key: "address", label: "Postal address with PIN", weight: 8, why: "Required in every cold email by Indian and global anti-spam rules.", example: "IIT Bombay, Powai, Mumbai 400076" },
];

export function readBrief(text: string) {
  const t = text || "";
  const parts = t.split(/[,|;\n]/).map((s) => s.trim()).filter(Boolean);
  const first = parts[0] || "";
  const split = first.match(/^(.*?\b20\d{2})\s+(.+)$/);
  const name = (split && ORG.test(split[2]) ? split[1] : first).trim();
  const orgPart = (split && ORG.test(split[2]) ? split[2] : "") || parts.slice(1).find((p) => ORG.test(p) && !MONTH.test(p)) || (t.match(/\b(?:by|organi[sz]ed by)\s+([^,.\n]+)/i)?.[1] || "");
  const date = parts.find((p) => MONTH.test(p) || /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(p)) || "";
  const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(t)) || "";
  const count = t.match(COUNT)?.[0] || "";
  const aud = t.match(new RegExp(`[^,.;\\n]*${AUDIENCE.source}[^,.;\\n]*`, "i"))?.[0]?.trim() || "";
  const goal = t.match(GOAL)?.[0] || (t.match(MONEY)?.[0] || "");
  const pin = t.match(/[^,\n]*\b\d{6}\b/)?.[0]?.trim() || "";
  const found: Record<BriefField, string> = {
    name: /[a-z]{3,}/i.test(name) ? name : "", organiser: orgPart.trim(), dates: date, city: city === "Bombay" || city === "Powai" ? "Mumbai" : city,
    footfall: count, audience: aud && aud !== count ? aud : "", goal: goal.trim(), address: pin,
  };
  const fields: FieldInfo[] = FIELDS.map((f) => ({ ...f, found: found[f.key] }));
  const score = Math.min(100, fields.reduce((s, f) => s + (f.found ? f.weight : 0), 0));
  const level = score >= 80 ? "Excellent" : score >= 55 ? "Good" : score >= 30 ? "Basic" : "Too thin";
  return { fields, score, level, missing: fields.filter((f) => !f.found) };
}
