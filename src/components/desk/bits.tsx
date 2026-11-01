"use client";

import type { ReactNode } from "react";

import { CheckCircle2, CircleAlert, CircleDashed, CircleHelp } from "lucide-react";

import { cn } from "cn";

import { type Any, hue, initials, STAGE_LABEL, VLABEL } from "./format";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance md:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function CompanyAvatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const h = hue(name);
  return (
    <div
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-xl font-heading font-bold text-white shadow-sm", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, oklch(0.62 0.17 ${h}), oklch(0.46 0.19 ${(h + 40) % 360}))` }}
    >
      {initials(name)}
    </div>
  );
}

export function PriorityBadge({ p, className }: { p?: string; className?: string }) {
  if (!p) return null;
  const tone = p === "P1" ? "bg-primary text-primary-foreground" : p === "P2" ? "bg-gold/25 text-gold-foreground dark:text-gold" : p === "P3" ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive";
  return <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[0.7rem] font-bold tracking-wide", tone, className)}>{p}</span>;
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const bad = ["DISQUALIFIED", "LOST", "OPTED_OUT", "BOUNCED", "NO_RESPONSE"].includes(stage);
  const won = ["PAID", "MOU_SIGNED", "INKIND_CONFIRMED", "NURTURE", "DELIVERED"].includes(stage);
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[0.7rem] font-medium", bad ? "border-destructive/30 text-destructive" : won ? "border-success/40 text-success" : "border-border text-muted-foreground", className)}>
      {STAGE_LABEL[stage] || stage}
    </span>
  );
}

export function VerifyBadge({ s, className }: { s?: string; className?: string }) {
  if (!s) return null;
  const map: Record<string, [string, Any]> = {
    VERIFIED: ["text-success bg-success/10", CheckCircle2], CORROBORATED: ["text-info bg-info/10", CheckCircle2],
    UNVERIFIED: ["text-warning bg-warning/15", CircleAlert], OUTDATED: ["text-warning bg-warning/15", CircleAlert], UNAVAILABLE: ["text-muted-foreground bg-muted", CircleDashed],
  };
  const [tone, Icon] = map[s] || ["text-muted-foreground bg-muted", CircleHelp];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[0.7rem] font-medium", tone, className)} title="Verified: Crustdata confirmed it is deliverable and it is on the company's own domain">
      <Icon className="size-3" />{VLABEL[s] || s}
    </span>
  );
}

/** Small ring that shows the fit score (the lower of the two scores). */
export function FitRing({ value, size = 44 }: { value?: number | null; size?: number }) {
  const v = Math.max(0, Math.min(100, Number(value ?? 0)));
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const color = v >= 70 ? "var(--primary)" : v >= 50 ? "var(--gold)" : "var(--muted-foreground)";
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} title={`Fit ${v}/100: the lower of our score and theirs`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={5} />
        {value != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />}
      </svg>
      <span className="absolute font-heading text-xs font-bold num">{value == null ? "–" : v}</span>
    </div>
  );
}

export function ScoreBar({ label, value, tone = "primary" }: { label: string; value?: number | null; tone?: "primary" | "gold" }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-12 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone === "gold" ? "bg-gold" : "bg-primary")} style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className="w-7 text-right font-semibold num">{value ?? "–"}</span>
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = "primary" }: { label: string; value: ReactNode; sub?: ReactNode; icon?: Any; tone?: "primary" | "gold" | "success" | "warning" }) {
  const toneCls = { primary: "bg-primary/10 text-primary", gold: "bg-gold/20 text-gold-foreground dark:text-gold", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning" }[tone];
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      {Icon && <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneCls)}><Icon className="size-4.5" /></div>}
      <div className="min-w-0">
        <div className="font-heading text-2xl font-bold leading-none num">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        {sub && <div className="mt-1 text-[0.7rem] text-muted-foreground/80">{sub}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: Any; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      {Icon && <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></div>}
      <div className="font-heading text-lg font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}

/** Lightweight formatting for assistant answers: **bold**, bullet lines and numbered lines. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = String(text || "").split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^(- |\d+\. )/.test(l.trim()) || !l.trim())) {
          const ordered = /^\d+\. /.test(lines[0].trim());
          const L = ordered ? "ol" : "ul";
          return <L key={i} className={cn("space-y-1 pl-4", ordered ? "list-decimal" : "list-disc")}>{lines.filter((l) => l.trim()).map((l, j) => <li key={j}>{inline(l.trim().replace(/^(- |\d+\. )/, ""))}</li>)}</L>;
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{l.startsWith("- ") ? <>• {inline(l.slice(2))}</> : inline(l)}</span>)}</p>;
      })}
    </div>
  );
}
