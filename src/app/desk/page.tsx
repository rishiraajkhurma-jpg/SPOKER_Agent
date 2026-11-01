"use client";

import { useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowRight, Building2, CalendarDays, ClipboardPen, Gavel, MapPin, Rocket, Send, Sparkles, Target, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AgentFlow } from "@/components/desk/agent-flow";
import { CompanyAvatar, FitRing, PriorityBadge, Stat, StageBadge } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, ago, brandName, clock, COLUMNS, isHuman, lakh, STAGE_LABEL, visibleLog } from "@/components/desk/format";

function Welcome() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-hero p-8 text-white shadow-lg md:p-12">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-80 rounded-full bg-gold/30 blur-3xl" />
        <div className="relative max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Sparkles className="size-3.5 text-gold" />Welcome to SponsorDesk</span>
          <h1 className="font-heading text-4xl leading-tight font-bold text-balance md:text-5xl">Tell the desk about your event. The agents find the sponsors.</h1>
          <p className="text-lg text-white/80">Two minutes on a good brief gets you a priced package, a priority list of companies with fresh budgets, and offers drafted to the right person.</p>
          <Button size="lg" className="h-11 bg-gold px-5 text-base font-semibold text-gold-foreground hover:bg-gold/90" nativeButton={false} render={<Link href="/desk/brief" />}>
            Write the event brief<ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [ClipboardPen, "1. Brief", "Name, organiser, dates, footfall, audience, goal. The meter tells you what is missing."],
          [Target, "2. Lock the floor", "Check four priced tiers and the smallest deal you accept without a person."],
          [Rocket, "3. Run the autopilot", "Sponsors with fresh budgets, both-sided scores, verified contacts and drafted offers."],
        ].map(([Icon, t, d]: Any) => (
          <div key={t} className="rounded-2xl border bg-card p-5"><Icon className="mb-3 size-6 text-primary" /><div className="font-heading font-semibold">{t}</div><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, busy, progress, autopilot, openCompany, can, ask } = useDesk();
  const [count, setCount] = useState(8);
  const e = data.event;
  if (!e) return <Welcome />;
  const cos: Any[] = data.companies;
  const live = cos.filter((c) => c.stage !== "DISQUALIFIED");
  const scored = live.filter((c) => c.intersection != null).sort((a, b) => (b.intersection || 0) - (a.intersection || 0));
  const p1 = scored.filter((c) => c.priority === "P1").length, p2 = scored.filter((c) => c.priority === "P2").length;
  const drafts = data.messages.filter((m: Any) => m.status === "drafted");
  const ex = data.exceptions.filter((x: Any) => x.status === "open");
  const won = data.deals.reduce((s: number, d: Any) => s + Number(d.cash_inr || 0), 0);
  const goal = Number(e.goal_inr || 0);
  const funnel = COLUMNS.slice(0, 6).map((col) => ({ ...col, n: cos.filter((c) => col.stages.includes(c.stage)).length }));
  const maxN = Math.max(1, ...funnel.map((f) => f.n));
  const prospects = cos.filter((c) => c.stage === "PROSPECT").length;
  const log = data.log.filter(visibleLog).slice(0, 8);
  const coName = (id: string) => brandName(cos.find((c) => c.id === id) || { name: id });

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-lg md:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("rounded-full px-2.5 py-1 font-bold uppercase tracking-wide", e.floor_locked ? "bg-emerald-400/20 text-emerald-200" : "bg-gold/30 text-gold")}>{e.floor_locked ? "Desk is live" : "Setup"}</span>
              {e.event_type && <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold capitalize">{e.event_type} event</span>}
            </div>
            <h1 className="font-heading text-3xl leading-tight font-bold md:text-4xl">{e.name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
              {e.organizer && <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" />{e.organizer}</span>}
              {e.dates && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{e.dates}</span>}
              {e.city && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{e.city}</span>}
            </div>
            {goal > 0 && (
              <div className="max-w-md">
                <div className="flex justify-between text-xs text-white/75"><span>{lakh(won)} in MOUs</span><span>Goal {lakh(goal)}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.max(2, Math.min(100, (won / goal) * 100))}%` }} /></div>
              </div>
            )}
          </div>
          <div className="w-full rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur lg:w-[360px]">
            {!e.floor_locked ? (
              <div className="space-y-3">
                <div className="font-heading font-semibold">Lock your floor to start</div>
                <p className="text-sm text-white/75">Check the four tiers and the smallest deal the agents may accept. Suggested floor {lakh(e.floor_inr)}.</p>
                <Button className="w-full bg-gold font-semibold text-gold-foreground hover:bg-gold/90" nativeButton={false} render={<Link href="/desk/brief" />}>Review tiers and lock<ArrowRight className="size-4" /></Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div className="font-heading font-semibold">Autopilot</div><span className="text-xs text-white/70">≈10 credits per sponsor</span></div>
                <div className="flex gap-2">
                  <NativeSelect value={String(count)} onChange={(x) => setCount(Number(x.target.value))} aria-label="How many companies" className="border-white/20 bg-white/10 text-white">
                    {[5, 8, 12, 15, 20].map((n) => <NativeSelectOption key={n} value={String(n)} className="text-foreground">{n} companies</NativeSelectOption>)}
                  </NativeSelect>
                  <Button className="flex-1 bg-gold font-semibold text-gold-foreground hover:bg-gold/90" disabled={!!busy || !!progress || !can("operator")} onClick={() => autopilot(count)}>
                    <Rocket className="size-4" />{progress ? "Running..." : "Find sponsors"}
                  </Button>
                </div>
                {progress ? (
                  <div><div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${((progress.done + 1) / Math.max(progress.total, 1)) * 100}%` }} /></div><div className="mt-1.5 truncate text-xs text-white/75">{progress.label}</div></div>
                ) : prospects > 0 ? <div className="text-xs text-white/75">{prospects} found compan{prospects > 1 ? "ies are" : "y is"} waiting to be scored; the autopilot picks them up.</div> : null}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Building2} label="companies on the desk" value={cos.length} sub={`${prospects} waiting to be scored`} />
        <Stat icon={Trophy} tone="gold" label="P1 and P2 targets" value={`${p1} · ${p2}`} sub="both scores 70+ · 50+" />
        <Stat icon={Send} label="offers waiting for you" value={drafts.length} sub={drafts.length ? <Link className="text-primary hover:underline" href="/desk/outbox">Review in Outbox →</Link> : "nothing to approve"} />
        <Stat icon={Gavel} tone="warning" label="decisions only you make" value={ex.length} sub={ex.length ? <Link className="text-primary hover:underline" href="/desk/inbox">Open Inbox →</Link> : "all clear"} />
        <Stat icon={Users} tone="success" label="verified decision makers" value={data.contacts.filter((c: Any) => c.is_primary && c.email_status === "VERIFIED").length} sub="work email confirmed" />
      </div>

      <section className="rounded-3xl border bg-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-heading text-lg font-semibold">Your agents</h2><p className="text-sm text-muted-foreground">Who is working, what they produced, and where they need you.</p></div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/desk/agents" />}>Open agent flow<ArrowRight className="size-3.5" /></Button>
        </div>
        <AgentFlow compact />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl border bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div><h2 className="font-heading text-lg font-semibold">Top targets</h2><p className="text-sm text-muted-foreground">Highest fit first, with the reason in one line.</p></div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/desk/companies" />}>All companies<ArrowRight className="size-3.5" /></Button>
          </div>
          {scored.length ? (
            <div className="space-y-2">
              {scored.slice(0, 6).map((c) => (
                <button key={c.id} type="button" onClick={() => openCompany(c.id)} className="flex w-full items-center gap-3 rounded-2xl border bg-background p-3 text-left transition hover:border-primary hover:shadow-sm">
                  <CompanyAvatar name={brandName(c)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate font-semibold">{brandName(c)}</span><PriorityBadge p={c.priority} /><StageBadge stage={c.stage} className="hidden sm:inline-flex" /></div>
                    <div className="truncate text-xs text-muted-foreground">{c.reasons?.why_fit?.[1] || c.reasons?.why_fit?.[0] || c.angle || c.why_now}</div>
                  </div>
                  <div className="hidden text-right sm:block"><div className="text-xs font-semibold text-gold-foreground dark:text-gold">{c.price_range}</div><div className="text-[0.65rem] text-muted-foreground">{c.reasons?.about?.industry || ""}</div></div>
                  <FitRing value={c.intersection} />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{e.floor_locked ? "Run the autopilot to find and score sponsors." : "Lock the floor, then run the autopilot."}</div>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold">Pipeline</h2>
            <div className="space-y-2">
              {funnel.map((f) => (
                <Link key={f.title} href="/desk/pipeline" className="group flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground group-hover:text-foreground">{f.title}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-muted"><div className="flex h-full items-center rounded-lg bg-gradient-to-r from-primary to-primary/70 px-2 text-xs font-bold text-primary-foreground" style={{ width: `${Math.max(f.n ? 12 : 0, (f.n / maxN) * 100)}%` }}>{f.n || ""}</div></div>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-lg font-semibold">Live activity</h2><button type="button" onClick={() => ask("What's going on?")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Sparkles className="size-3.5" />Explain this</button></div>
            <ol className="space-y-2.5" aria-live="polite">
              {log.map((l: Any) => (
                <li key={l.id} className="flex gap-2.5 text-sm">
                  <span className={cn("mt-0.5 grid h-5 min-w-8 shrink-0 place-items-center rounded-md px-1 text-[0.6rem] font-bold", isHuman(l.actor) ? "bg-gold/25 text-gold-foreground dark:text-gold" : "bg-primary/10 text-primary")}>{isHuman(l.actor) ? "You" : l.actor === "Email" ? "@" : l.actor}</span>
                  <span className="line-clamp-2 min-w-0 flex-1">
                    {l.company_id && <button type="button" className="mr-1 font-semibold hover:underline" onClick={() => openCompany(l.company_id)}>{coName(l.company_id)}</button>}
                    <span className="text-muted-foreground">{String(l.detail || STAGE_LABEL[l.to_stage] || l.action).slice(0, 140)}</span>
                  </span>
                  <span className="shrink-0 text-[0.65rem] text-muted-foreground" title={clock(l.ts)}>{ago(l.ts)}</span>
                </li>
              ))}
              {!log.length && <li className="text-sm text-muted-foreground">The desk is quiet.</li>}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
