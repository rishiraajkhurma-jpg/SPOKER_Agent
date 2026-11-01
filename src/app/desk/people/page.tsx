"use client";

import { useState } from "react";

import { cn } from "cn";
import { Download, Search, UserCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyAvatar, EmptyState, PageHeader, PriorityBadge, VerifyBadge } from "@/components/desk/bits";
import { ContactCard } from "@/components/desk/company-sheet";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName } from "@/components/desk/format";

export default function PeoplePage() {
  const { data, openCompany } = useDesk();
  const [tab, setTab] = useState<"dm" | "all">("dm");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("");
  const byCo: Record<string, Any[]> = {};
  for (const c of data.contacts) (byCo[c.company_id] ||= []).push(c);
  const needsCheck = (ct: Any) => ct?.is_primary && !ct.reviewed_at && ["UNVERIFIED", "UNAVAILABLE", "OUTDATED"].includes(ct.email_status);
  const rows = data.companies
    .filter((co: Any) => byCo[co.id]?.length && (!q || `${co.name} ${JSON.stringify(byCo[co.id])}`.toLowerCase().includes(q.toLowerCase())))
    .map((co: Any) => ({ co, p: byCo[co.id].find((c) => c.is_primary) || byCo[co.id][0] }))
    .sort((a: Any, b: Any) => Number(needsCheck(b.p)) - Number(needsCheck(a.p)) || (b.co.intersection ?? -1) - (a.co.intersection ?? -1));
  const review = rows.filter((r: Any) => needsCheck(r.p)).length;
  const cur = rows.find((r: Any) => r.co.id === sel);
  const all = data.contacts.filter((c: Any) => !q || JSON.stringify(c).toLowerCase().includes(q.toLowerCase()));
  const coOf = (id: string) => data.companies.find((c: Any) => c.id === id) || { name: id };

  return (
    <>
      <PageHeader eyebrow="Agent A2 · Outreach" title="People" description="The right person at each company, how their email was checked, and why they were picked. Nothing is guessed: a missing detail stays missing.">
        <Button variant="outline" nativeButton={false} render={<a href="/api/export" />}><Download className="size-4" />Export CSV</Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border bg-card p-1">
          <button type="button" onClick={() => setTab("dm")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", tab === "dm" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Decision makers {review ? `· ${review} to check` : ""}</button>
          <button type="button" onClick={() => setTab("all")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", tab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>All contacts · {data.contacts.length}</button>
        </div>
        <div className="relative min-w-52 flex-1"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, titles, companies" className="pl-8" aria-label="Search people" /></div>
      </div>

      {!data.contacts.length ? <EmptyState icon={Users} title="No people yet">Score a company to find its decision makers.</EmptyState> : tab === "dm" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            {rows.map(({ co, p }: Any) => (
              <button key={co.id} type="button" onClick={() => setSel(sel === co.id ? "" : co.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-primary/50", sel === co.id && "border-primary ring-2 ring-primary/15", needsCheck(p) && "border-gold/60")}>
                <CompanyAvatar name={brandName(co)} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-semibold">{p.full_name}</span><PriorityBadge p={co.priority} /></div>
                  <div className="truncate text-xs text-muted-foreground">{p.position} · {brandName(co)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <VerifyBadge s={p.email_status} />
                  {needsCheck(p) ? <span className="text-[0.65rem] font-semibold text-gold-foreground dark:text-gold">needs your check</span> : p.relevance != null && <span className="text-[0.65rem] text-muted-foreground num">relevance {p.relevance}</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
            {cur ? (
              <>
                <div className="flex items-center justify-between"><h2 className="font-heading text-lg font-semibold">{brandName(cur.co)}</h2><Button variant="ghost" size="sm" onClick={() => openCompany(cur.co.id)}>Open company →</Button></div>
                {cur.co.angle && <p className="rounded-2xl bg-primary/5 p-3 text-sm">{cur.co.angle}</p>}
                {[...byCo[cur.co.id]].sort((a: Any, b: Any) => (b.is_primary - a.is_primary) || ((b.relevance ?? -1) - (a.relevance ?? -1))).map((ct: Any) => <ContactCard key={ct.id} ct={ct} co={cur.co} />)}
              </>
            ) : <EmptyState icon={UserCheck} title="Pick a company">See every person found there, how each email was checked, and the relevance breakdown.</EmptyState>}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Name", "Company", "Title", "Email", "Phone", "Relevance", "Summary"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {all.map((c: Any) => (
                <tr key={c.id} onClick={() => openCompany(c.company_id)} className="cursor-pointer border-t hover:bg-muted/40">
                  <td className="px-4 py-2.5"><div className="font-semibold">{c.full_name}</div><div className="text-[0.7rem] text-muted-foreground">{c.is_primary ? "primary" : c.kind}{c.iitb_alum === "yes" ? " · alumni of organiser" : ""}</div></td>
                  <td className="px-4 py-2.5">{brandName(coOf(c.company_id))}</td>
                  <td className="max-w-56 px-4 py-2.5 text-xs">{c.position}</td>
                  <td className="px-4 py-2.5">{c.email ? <div className="space-y-0.5"><div className="text-xs">{c.email}</div><VerifyBadge s={c.email_status} /></div> : <span className="text-muted-foreground">–</span>}</td>
                  <td className="px-4 py-2.5 text-xs">{c.phone || "–"}</td>
                  <td className="px-4 py-2.5 num">{c.relevance ?? "–"}</td>
                  <td className="max-w-72 px-4 py-2.5 text-xs text-muted-foreground">{c.one_liner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
