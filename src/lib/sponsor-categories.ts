// Sponsor categories an organiser can ask for. Each maps to Crustdata industry labels
// (checked against /company/search/autocomplete on taxonomy.professional_network_industry).
// Shared by the brief composer (browser) and discovery (server): no server imports here.
export type SponsorCategory = { id: string; label: string; hint: string; industries: string[] };

export const SPONSOR_CATEGORIES: SponsorCategory[] = [
  { id: "food", label: "Food and beverages", hint: "snacks, drinks, dairy, QSR", industries: ["Food and Beverage Services", "Food and Beverage Manufacturing", "Beverage Manufacturing", "Dairy Product Manufacturing", "Restaurants"] },
  { id: "fashion", label: "Fashion and sportswear", hint: "apparel, shoes, sports gear", industries: ["Retail Apparel and Fashion", "Sporting Goods Manufacturing", "Textile Manufacturing"] },
  { id: "fintech", label: "Fintech and banking", hint: "payments, banks, trading apps", industries: ["Financial Services", "Banking", "Capital Markets", "Investment Management", "Insurance", "Credit Intermediation"] },
  { id: "tech", label: "Tech and SaaS", hint: "software, cloud, AI", industries: ["Software Development", "IT Services and IT Consulting", "Technology, Information and Internet"] },
  { id: "edtech", label: "Edtech and learning", hint: "courses, test prep, upskilling", industries: ["E-Learning Providers", "Professional Training and Coaching", "Education"] },
  { id: "media", label: "Media and entertainment", hint: "OTT, music, TV, creators", industries: ["Entertainment Providers", "Online Audio and Video Media", "Broadcast Media Production and Distribution", "Movies, Videos, and Sound", "Media Production"] },
  { id: "gaming", label: "Gaming and esports", hint: "games, esports orgs", industries: ["Computer Games", "Mobile Games"] },
  { id: "health", label: "Health, fitness and beauty", hint: "gyms, wellness, personal care", industries: ["Wellness and Fitness Services", "Personal Care Product Manufacturing", "Hospitals and Health Care", "Health, Wellness & Fitness"] },
  { id: "electronics", label: "Telecom and electronics", hint: "phones, audio, telecom", industries: ["Telecommunications", "Computers and Electronics Manufacturing", "Appliances, Electrical, and Electronics Manufacturing"] },
  { id: "auto", label: "Auto and mobility", hint: "two-wheelers, EVs, cabs", industries: ["Motor Vehicle Manufacturing", "Transportation Equipment Manufacturing", "Transportation, Logistics, Supply Chain and Storage"] },
  { id: "travel", label: "Travel and hospitality", hint: "airlines, hotels, travel apps", industries: ["Travel Arrangements", "Hospitality", "Airlines and Aviation"] },
  { id: "retail", label: "Retail and e-commerce", hint: "marketplaces, quick commerce", industries: ["Retail", "Food and Beverage Retail", "Consumer Services"] },
  { id: "hiring", label: "Recruiters and consulting", hint: "internships, hiring, case partners", industries: ["Business Consulting and Services", "Staffing and Recruiting", "Human Resources Services"] },
  { id: "startups", label: "Startups and VCs", hint: "funds, accelerators, founders", industries: ["Venture Capital and Private Equity Principals"] },
];

export const categoryById = (id: string) => SPONSOR_CATEGORIES.find((c) => c.id === id);
export function industriesFor(ids: string[] = []) {
  return [...new Set(ids.flatMap((id) => categoryById(id)?.industries || []))];
}
