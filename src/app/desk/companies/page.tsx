"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { AlertTriangle, Building2, Check, LayoutGrid, Mail, Plus, Search, Sparkles, Star, Table2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CompanyAvatar, EmptyState, FitRing, PageHeader, PriorityBadge, ScoreBar, StageBadge, VerifyBadge } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName, MODEL_LABEL } from "@/components/desk/format";

const GROUPS = [
  { key: "P1", title: "P1 · Pitch now", sub: "Both scores 70 or more", test: (c: Any) => c.priority === "P1" && c.stage !== "DISQUALIFIED" },
  { key: "P2", title: "P2 · Worth a pitch", sub: "Both scores 50 or more", test: (c: Any) => c.priority === "P2" && c.stage !== "DISQUALIFIED" },
  { key: "P3", title: "P3 · Low priority", sub: "Smaller ask or partial fit", test: (c: Any) => c.priority === "P3" && c.stage !== "DISQUALIFIED" },
  { key: "new", title: "Not scored yet", sub: "Found by discovery or added by you", test: (c: Any) => c.intersection == null && c.stage !== "DISQUALIFIED" },
  { key: "drop", title: "Dropped", sub: "Brand safety, distress or poor fit", test: (c: Any) => c.stage === "DISQUALIFIED" },
];

function CompanyCard({ c, primary }: { c: Any; primary: Any }) {
  const { openCompany, act, busy } = useDesk();
  const r = c.reasons || {};
  const ab = r.about || {};
  const why: string[] = r.why_fit || [];
  const risky = (r.signals || []).some((s: Any) => /^(Negative|Caution)/.test(s.claim));
  const brand = brandName(c);
  return (
    <article className="group flex flex-col rounded-3xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-md">
      <button type="button" onClick={() => openCompany(c.id)} className="flex items-start gap-3 text-left">
        <CompanyAvatar name={brand} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h3 className="truncate font-heading text-base font-bold group-hover:text-primary">{brand}</h3><PriorityBadge p={c.priority} />{r.requested && <Star className="size-3.5 fill-gold text-gold" aria-label="You asked for this brand" />}</div>
          <div className="truncate text-xs text-muted-foreground">{[ab.industry || r.industry, ab.headcount ? `${Number(ab.headcount).toLocaleString("en-IN")} people` : ""].filter(Boolean).join(" · ") || c.domain}</div>
        </div>
        <FitRing value={c.intersection} />
      </button>
      <p className="mt-3 line-clamp-2 text-sm text-foreground/85">{ab.description || c.why_now || "No description yet."}</p>
      {why.length > 0 ? (
        <ul className="mt-3 space-y-1.5 rounded-2xl bg-primary/5 p-3">
          {why.slice(0, 3).map((w, i) => <li key={i} className="flex gap-2 text-xs"><Check className="mt-0.5 size-3.5 shrink-0 text-success" /><span className="line-clamp-2">{w}</span></li>)}
        </ul>
      ) : c.why_now ? <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-xs">{c.why_now}</p> : null}
      {c.our_pov != null && <div className="mt-3 space-y-1"><ScoreBar label="Ours" value={c.our_pov} /><ScoreBar label="Theirs" value={c.their_pov} tone="gold" /></div>}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
        <StageBadge stage={c.stage} />
        {c.price_range && <span className="font-semibold text-gold-foreground dark:text-gold">{c.price_range}</span>}
        {c.model && <span className="text-muted-foreground">{MODEL_LABEL(c.model)}</span>}
        {risky && <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3.5" />News to check</span>}
        <span className="ml-auto" />
        {primary ? (
          <span className="inline-flex min-w-0 items-center gap-1.5"><Users className="size-3.5 shrink-0 text-muted-foreground" /><span className="max-w-32 truncate">{primary.full_name}</span><VerifyBadge s={primary.email_status} /></span>
        ) : c.intersection == null && c.stage !== "DISQUALIFIED" ? (
          <Button size="xs" disabled={!!busy} onClick={() => act("analyze", { company_id: c.id }, `Scoring ${c.name}`)}><Sparkles className="size-3" />Score</Button>
        ) : null}
      </div>
    </article>
  );
}

export default function CompaniesPage() {
  const { data, act, busy, openCompany, can } = useDesk();
  const [q, setQ] = useState("");
  const [pri, setPri] = useState("all");
  const [ind, setInd] = useState("");
  const [sort, setSort] = useState("fit");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [add, setAdd] = useState({ name: "", domain: "" });
  const [adding, setAdding] = useState(false);
  const cos: Any[] = data.companies;
  const primaryOf = (id: string) => data.contacts.find((x: Any) => x.company_id === id && x.is_primary);
  const industries = useMemo(() => [...new Set(cos.map((c) => c.reasons?.about?.industry || c.reasons?.industry).filter(Boolean))].sort() as string[], [cos]);
  const list = cos
    .filter((c) => !q || `${c.name} ${c.domain} ${c.reasons?.about?.description || ""}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !ind || (c.reasons?.about?.industry || c.reasons?.industry) === ind)
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? (b.reasons?.about?.headcount || 0) - (a.reasons?.about?.headcount || 0) : (b.intersection ?? -1) - (a.intersection ?? -1));
  const groups = GROUPS.filter((g) => pri === "all" || g.key === pri).map((g) => ({ ...g, items: list.filter(g.test) })).filter((g) => g.items.length);
  const counts = Object.fromEntries(GROUPS.map((g) => [g.key, cos.filter(g.test).length]));

  return (
    <>
      <PageHeader eyebrow="Agent A1 · Prospect" title="Companies" description="Your priority list. Each card says who the company is and why it suits your event. Open one for the full story, people and next steps.">
        <Button variant={adding ? "secondary" : "outline"} onClick={() => setAdding(!adding)}><Plus className="size-4" />Add a company</Button>
      </PageHeader>

      {adding && (
        <form className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); act("add_company", add).then((r: Any) => { if (r?.id) { const n = add.name; setAdd({ name: "", domain: "" }); setAdding(false); act("analyze", { company_id: r.id }, `Scoring ${n}`).then(() => openCompany(r.id)); } }); }}>
          <div className="min-w-48 flex-1 space-y-1"><label htmlFor="add-name" className="text-xs font-medium text-muted-foreground">Company or brand</label><Input id="add-name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="e.g. Decathlon India" /></div>
          <div className="min-w-40 flex-1 space-y-1"><label htmlFor="add-domain" className="text-xs font-medium text-muted-foreground">Website</label><Input id="add-domain" value={add.domain} onChange={(e) => setAdd({ ...add, domain: e.target.value })} placeholder="decathlon.in" /></div>
          <Button type="submit" disabled={!add.name || !!busy || !can("operator")}>Add and score</Button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
          {[["all", `All ${cos.length}`], ["P1", `P1 ${counts.P1}`], ["P2", `P2 ${counts.P2}`], ["new", `Not scored ${counts.new}`], ["drop", `Dropped ${counts.drop}`]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPri(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition num", pri === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, website or description" className="pl-8" aria-label="Search companies" /></div>
        <NativeSelect value={ind} onChange={(e) => setInd(e.target.value)} aria-label="Industry"><NativeSelectOption value="">All industries</NativeSelectOption>{industries.map((i) => <NativeSelectOption key={i} value={i}>{i}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><NativeSelectOption value="fit">Best fit first</NativeSelectOption><NativeSelectOption value="size">Biggest first</NativeSelectOption><NativeSelectOption value="name">A to Z</NativeSelectOption></NativeSelect>
        <div className="flex rounded-xl border bg-card p-1">
          <button type="button" aria-label="Card view" onClick={() => setView("cards")} className={cn("rounded-lg p-1.5", view === "cards" && "bg-muted")}><LayoutGrid className="size-4" /></button>
          <button type="button" aria-label="Table view" onClick={() => setView("table")} className={cn("rounded-lg p-1.5", view === "table" && "bg-muted")}><Table2 className="size-4" /></button>
        </div>
      </div>

      {!cos.length ? (
        <EmptyState icon={Building2} title="No companies yet">Lock the floor on the Event brief page, then run the autopilot from the Dashboard. Or add a company you already know.</EmptyState>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Company", "Priority", "Fit", "Ours / theirs", "Offer", "Decision maker", "Stage"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => { const p = primaryOf(c.id); return (
                <tr key={c.id} onClick={() => openCompany(c.id)} className="cursor-pointer border-t transition hover:bg-muted/40">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><CompanyAvatar name={brandName(c)} size={30} /><div className="min-w-0"><div className="font-semibold">{brandName(c)}</div><div className="max-w-72 truncate text-xs text-muted-foreground">{c.reasons?.about?.industry || c.domain}</div></div></div></td>
                  <td className="px-4 py-2.5"><PriorityBadge p={c.priority} /></td>
                  <td className="px-4 py-2.5 font-semibold num">{c.intersection ?? "–"}</td>
                  <td className="px-4 py-2.5 num text-muted-foreground">{c.our_pov ?? "–"} / {c.their_pov ?? "–"}</td>
                  <td className="px-4 py-2.5 text-xs">{c.price_range || "–"}</td>
                  <td className="px-4 py-2.5">{p ? <div className="flex items-center gap-1.5"><Mail className="size-3.5 text-muted-foreground" /><span className="max-w-40 truncate">{p.full_name}</span><VerifyBadge s={p.email_status} /></div> : <span className="text-muted-foreground">–</span>}</td>
                  <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-baseline gap-3"><h2 className="font-heading text-lg font-bold">{g.title}</h2><span className="text-sm text-muted-foreground">{g.items.length} · {g.sub}</span></div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{g.items.map((c) => <CompanyCard key={c.id} c={c} primary={primaryOf(c.id)} />)}</div>
            </section>
          ))}
          {!groups.length && <EmptyState icon={Search} title="Nothing matches">Try another filter or search.</EmptyState>}
        </div>
      )}
    </>
  );
}
