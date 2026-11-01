"use client";

import { useState } from "react";

import { cn } from "cn";
import { Hand, ShieldCheck, Sparkles } from "lucide-react";

import { AgentFlow, useAgentStates } from "@/components/desk/agent-flow";
import { PageHeader } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, ago, AGENTS, brandName, isHuman, STAGE_LABEL, visibleLog, when } from "@/components/desk/format";
import { Button } from "@/components/ui/button";

export default function AgentsPage() {
  const { data, ask, openCompany } = useDesk();
  const states = useAgentStates();
  const [who, setWho] = useState("all");
  const [limit, setLimit] = useState(25);
  const needs = states.filter((s) => s.status === "needs");
  const all = (data.log || []).filter(visibleLog).filter((l: Any) => (who === "all" ? true : who === "you" ? isHuman(l.actor) : l.actor === who));
  const log = all.slice(0, limit);
  const coName = (id: string) => brandName(data.companies.find((c: Any) => c.id === id) || { name: id });
  return (
    <>
      <PageHeader eyebrow="How the desk works" title="Agents" description="Eight agents pass each sponsor along like an assembly line. They work on their own and stop only where a person must decide." />
      {needs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Hand className="size-5 text-primary" />
          <span className="text-sm font-semibold">{needs.length} agent{needs.length > 1 ? "s are" : " is"} waiting for you:</span>
          {needs.map((s) => <a key={s.id} href={s.cta?.href} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{s.id} {s.name} · {s.cta?.label}</a>)}
        </div>
      )}
      <section className="rounded-3xl border bg-card p-5 md:p-6"><AgentFlow /></section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-3xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">Activity</h2>
            <button type="button" onClick={() => ask("What's going on?")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Sparkles className="size-3.5" />Ask the desk to explain</button>
          </div>
          <div className="mb-4 flex flex-wrap gap-1">
            {[["all", "Everyone"], ...AGENTS.map((a) => [a.id, `${a.id} ${a.name}`]), ["you", "People"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setWho(k)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition", who === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{l}</button>
            ))}
          </div>
          <ol className="relative space-y-3 border-l pl-5">
            {log.map((l: Any) => (
              <li key={l.id} className="text-sm">
                <span className={cn("absolute -left-[7px] mt-1 grid size-3.5 place-items-center rounded-full border-2 border-card", isHuman(l.actor) ? "bg-gold" : "bg-primary")} />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-bold">{isHuman(l.actor) ? `You (${l.actor})` : l.actor}</span>
                  {l.company_id && <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => openCompany(l.company_id)}>{coName(l.company_id)}</button>}
                  <span className="text-[0.7rem] text-muted-foreground" title={when(l.ts)}>{ago(l.ts)}</span>
                </div>
                <div className="text-muted-foreground">{l.action === "stage" ? `Moved to ${STAGE_LABEL[l.to_stage] || l.to_stage}` : l.detail || l.action}</div>
              </li>
            ))}
            {!log.length && <li className="text-sm text-muted-foreground">No activity for this filter yet.</li>}
          </ol>
          {all.length > limit && <Button variant="outline" size="sm" className="mt-4" onClick={() => setLimit(limit + 25)}>Show {Math.min(25, all.length - limit)} more</Button>}
        </section>
        <aside className="space-y-4">
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold">A sponsor's journey</h2>
            <ol className="space-y-3 text-sm">
              {[
                ["A0", "You describe the event. A0 prices four tiers and suggests a floor."],
                ["A1", "A1 finds companies with fresh funding or growth in the industries you chose, and scores each from both sides."],
                ["A2", "A2 finds the person who owns the budget, checks their email, and drafts a priced offer for you to approve."],
                ["A3–A5", "When they reply, A3 books the call, A4 builds their deck, and A5 reads the notes and counters with trades, never discounts."],
                ["A6–A7", "A6 drafts the MOU. A7 keeps signed sponsors updated so they renew."],
              ].map(([id, t]) => <li key={id} className="flex gap-3"><span className="grid h-6 min-w-11 place-items-center rounded-md bg-primary/10 text-[0.65rem] font-bold text-primary">{id}</span><span>{t}</span></li>)}
            </ol>
          </section>
          <section className="flex gap-3 rounded-3xl border border-success/30 bg-success/10 p-5 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-success" />
            <p>Agents never send on their own. Every email passes the linter and waits for a named approver. Offers below your floor always come to you.</p>
          </section>
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-2 font-heading text-base font-semibold">Ask about an agent</h2>
            <div className="flex flex-wrap gap-1.5">{AGENTS.slice(0, 8).map((a) => <button key={a.id} type="button" onClick={() => ask(`What does ${a.id} do?`)} className="rounded-full border px-2.5 py-1 text-xs hover:border-primary hover:text-primary">What does {a.id} do?</button>)}</div>
          </section>
        </aside>
      </div>
    </>
  );
}
