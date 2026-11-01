"use client";

import Link from "next/link";

import { cn } from "cn";
import { ArrowRight, BadgeCheck, Box, CalendarClock, FileSignature, Hand, Loader2, Mail, Megaphone, MessageSquareReply, Presentation, Radar, Scale } from "lucide-react";

import { useDesk } from "./desk-provider";
import { type Any, ago, AGENTS, lakh, OP_AGENT } from "./format";

const ICON: Record<string, Any> = { A0: Box, A1: Radar, A2: MessageSquareReply, A3: CalendarClock, A4: Presentation, A5: Scale, A6: FileSignature, A7: Megaphone, Email: Mail };
type Status = "working" | "needs" | "done" | "idle";
export type AgentState = { id: string; name: string; job: string; status: Status; metric: string; detail: string; needs: number; cta?: { label: string; href: string }; last?: Any };

export function useAgentStates(): AgentState[] {
  const { data, busy, progress } = useDesk();
  const e = data?.event;
  const cos: Any[] = data?.companies || [];
  const msgs: Any[] = data?.messages || [];
  const ex: Any[] = (data?.exceptions || []).filter((x: Any) => x.status === "open");
  const contacts: Any[] = data?.contacts || [];
  const live = busy ? OP_AGENT[busy.op] : progress ? "A1" : "";
  const count = (f: (c: Any) => boolean) => cos.filter(f).length;
  const scored = count((c) => c.intersection != null && c.stage !== "DISQUALIFIED");
  const p1 = count((c) => c.priority === "P1" && c.stage !== "DISQUALIFIED");
  const drafts = msgs.filter((m) => m.status === "drafted").length;
  const verified = contacts.filter((c) => c.is_primary && c.email_status === "VERIFIED").length;
  const review = contacts.filter((c) => c.is_primary && !c.reviewed_at && ["UNVERIFIED", "UNAVAILABLE", "OUTDATED"].includes(c.email_status)).length;
  const meets = (data?.meetings || []).length;
  const decks = (data?.decks || []).length;
  const deals = (data?.deals || []).length;
  const sent = msgs.filter((m) => m.status === "sent").length;
  const signed = count((c) => ["MOU_SIGNED", "PAID", "NURTURE", "INKIND_CONFIRMED"].includes(c.stage));
  const below = ex.filter((x) => /below_floor/.test(x.kind)).length;
  const m: Record<string, Omit<AgentState, "id" | "name" | "job" | "status" | "last">> = {
    A0: !e ? { metric: "No brief yet", detail: "Waiting for your event brief", needs: 1, cta: { label: "Write the brief", href: "/desk/brief" } }
      : !e.floor_locked ? { metric: `Floor ${lakh(e.floor_inr)} suggested`, detail: "Check the tiers and lock the floor", needs: 1, cta: { label: "Lock the floor", href: "/desk/brief" } }
      : { metric: `Floor ${lakh(e.floor_inr)} locked`, detail: `${(e.tiers || []).length} tiers, goal ${lakh(e.goal_inr || 0)}`, needs: 0, cta: { label: "View brief", href: "/desk/brief" } },
    A1: { metric: cos.length ? `${scored} scored · ${p1} P1` : "No companies yet", detail: cos.length ? `${count((c) => c.stage === "PROSPECT")} waiting to be scored, ${count((c) => c.stage === "DISQUALIFIED")} dropped` : "Runs after the floor is locked", needs: 0, cta: { label: "See companies", href: "/desk/companies" } },
    A2: { metric: `${verified} verified contacts`, detail: drafts ? `${drafts} offers waiting for your approval` : review ? `${review} contacts need a check` : `${msgs.filter((x) => x.sequence === "cold").length} offers written`, needs: drafts + review, cta: drafts ? { label: "Approve offers", href: "/desk/outbox" } : review ? { label: "Check contacts", href: "/desk/people" } : { label: "See people", href: "/desk/people" } },
    A3: { metric: `${meets} meeting${meets === 1 ? "" : "s"}`, detail: meets ? "Booked with Google Meet links" : "Starts when a sponsor asks to talk", needs: 0, cta: { label: "Meetings", href: "/desk/meetings" } },
    A4: { metric: `${decks} deck${decks === 1 ? "" : "s"}`, detail: decks ? "Company-specific, shareable" : "Build one from a company page", needs: 0, cta: { label: "Companies", href: "/desk/companies" } },
    A5: { metric: below ? `${below} below your floor` : "No counters yet", detail: below ? "Trade-based counters waiting for you" : "Reads meeting notes and replies", needs: below, cta: { label: below ? "Decide" : "Inbox", href: "/desk/inbox" } },
    A6: { metric: `${deals} MOU${deals === 1 ? "" : "s"}`, detail: deals ? "Drafted from deal sheets" : "Drafts once terms are agreed", needs: 0, cta: { label: "Deals", href: "/desk/deals" } },
    A7: { metric: `${signed} signed sponsor${signed === 1 ? "" : "s"}`, detail: signed ? "Fortnightly updates ready to write" : "Starts after the first signature", needs: 0, cta: { label: "Updates", href: "/desk/sponsors" } },
    Email: { metric: `${sent} sent · ${drafts} to approve`, detail: data?.settings?.gmail ? `Sending as ${data.settings.gmail}` : "Draft mode: connect Gmail to send", needs: 0, cta: { label: "Outbox", href: "/desk/outbox" } },
  };
  return AGENTS.map((a) => {
    const last = (data?.log || []).find((l: Any) => l.actor === a.id);
    const x = m[a.id];
    const status: Status = live === a.id ? "working" : x.needs > 0 ? "needs" : last ? "done" : "idle";
    return { id: a.id, name: a.name, job: a.job, status, last, ...x, detail: live === a.id ? (busy?.label || progress?.label || x.detail) : x.detail };
  });
}

const TONE: Record<Status, { ring: string; chip: string; label: string }> = {
  working: { ring: "border-gold shadow-[0_0_0_3px_color-mix(in_oklch,var(--gold)_25%,transparent)]", chip: "bg-gold text-gold-foreground", label: "Working" },
  needs: { ring: "border-primary/50", chip: "bg-primary text-primary-foreground", label: "Needs you" },
  done: { ring: "border-border", chip: "bg-success/15 text-success", label: "Active" },
  idle: { ring: "border-dashed border-border", chip: "bg-muted text-muted-foreground", label: "Waiting" },
};

export function AgentCard({ a, compact }: { a: AgentState; compact?: boolean }) {
  const Icon = ICON[a.id];
  const t = TONE[a.status];
  return (
    <div className={cn("group relative flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3.5 transition", t.ring, a.status === "idle" && "opacity-75")}>
      <div className="flex items-center gap-2.5">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl", a.status === "working" ? "bg-gold text-gold-foreground animate-ring" : a.status === "needs" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
          {a.status === "working" ? <Loader2 className="size-4.5 animate-spin" /> : <Icon className="size-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase">{a.id === "Email" ? "Hub" : a.id}<span className={cn("rounded-full px-1.5 py-px text-[0.6rem] normal-case tracking-normal", t.chip)}>{t.label}{a.needs > 0 && a.status === "needs" ? ` · ${a.needs}` : ""}</span></div>
          <div className="truncate font-heading text-sm font-semibold">{a.name}</div>
        </div>
      </div>
      <div className="font-heading text-[0.95rem] leading-tight font-bold num">{a.metric}</div>
      {!compact && <div className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{a.detail}</div>}
      {!compact && a.last && <div className="truncate text-[0.68rem] text-muted-foreground/80" title={a.last.detail}>Last: {a.last.detail || a.last.action} · {ago(a.last.ts)}</div>}
      {a.cta && (
        <Link href={a.cta.href} className={cn("mt-auto inline-flex items-center gap-1 self-start rounded-lg text-xs font-semibold transition", a.status === "needs" ? "bg-primary px-2.5 py-1 text-primary-foreground hover:bg-primary/90" : "text-primary hover:underline")}>
          {a.status === "needs" && <Hand className="size-3" />}{a.cta.label}<ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="hidden items-center lg:flex">
      <div className={cn("h-0.5 w-6", active ? "animate-flow" : "bg-border")} />
      <ArrowRight className={cn("-ml-1 size-3.5", active ? "text-gold" : "text-border")} />
    </div>
  );
}

export function AgentFlow({ compact }: { compact?: boolean }) {
  const states = useAgentStates();
  const lane = (ids: string[], title: string, sub: string) => {
    const items = ids.map((id) => states.find((s) => s.id === id)!);
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2"><span className="font-heading text-sm font-semibold">{title}</span><span className="text-xs text-muted-foreground">{sub}</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0">
          {items.map((a, i) => (
            <div key={a.id} className="contents lg:flex lg:min-w-0 lg:flex-1 lg:items-stretch">
              <div className="min-w-0 lg:flex-1"><AgentCard a={a} compact={compact} /></div>
              {i < items.length - 1 && <Connector active={a.status === "working" || items[i + 1].status === "working"} />}
            </div>
          ))}
        </div>
      </div>
    );
  };
  const hub = states.find((s) => s.id === "Email")!;
  return (
    <div className="space-y-5">
      {lane(["A0", "A1", "A2", "A3"], "Win the deal", "brief → sponsors → offer → meeting")}
      {lane(["A4", "A5", "A6", "A7"], "Close and keep", "deck → negotiate → MOU → updates")}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-3">
        <div className="flex items-center gap-2"><BadgeCheck className="size-4 text-success" /><span className="text-sm font-semibold">Email agent hub</span></div>
        <span className="text-sm text-muted-foreground">Every email from every agent passes the linter, waits for a named approver, and is sent exactly once.</span>
        <span className="ml-auto rounded-full bg-card px-3 py-1 text-xs font-semibold num">{hub.metric}</span>
        <Link href="/desk/outbox" className="text-xs font-semibold text-primary hover:underline">Open Outbox →</Link>
      </div>
    </div>
  );
}
