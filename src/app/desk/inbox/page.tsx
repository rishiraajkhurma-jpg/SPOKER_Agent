"use client";

import { useState } from "react";

import { CheckCircle2, Gavel, Lightbulb, MailCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAvatar, EmptyState, PageHeader } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, ago, brandName, inr, when } from "@/components/desk/format";

const KIND: Record<string, string> = { below_floor: "Below your floor", no_email: "Email needed", no_contact: "No contact found", suspicious_email: "Suspicious email", reply_on_live_deal: "Reply on a live deal", unverified_email: "Unverified email", send_failed: "Send failed", meeting_exception: "From the meeting", below_floor_mou: "MOU below floor", verify_contact: "Check the contact", delivery_unknown: "Delivery uncertain", calendar_failed: "Calendar invite failed", recap_no_email: "Recap needs an email" };
const CLASS_TONE: Record<string, string> = { interested: "bg-success/15 text-success", meeting: "bg-primary/15 text-primary", need_info: "bg-info/15 text-info", referral: "bg-gold/25 text-gold-foreground dark:text-gold", not_now: "bg-muted text-muted-foreground", not_interested: "bg-destructive/15 text-destructive", opt_out: "bg-destructive/15 text-destructive", auto_reply: "bg-muted text-muted-foreground", bounce: "bg-destructive/15 text-destructive" };

function Decision({ x }: { x: Any }) {
  const { data, act, busy, can, openCompany, flash } = useDesk();
  const [e, setE] = useState({ subject: x.draft_subject || "", body: x.draft_body || "" });
  const c = data.companies.find((y: Any) => y.id === x.company_id);
  return (
    <article className="space-y-3 rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        {c && <CompanyAvatar name={brandName(c)} size={36} />}
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[0.7rem] font-bold text-gold-foreground dark:text-gold">{KIND[x.kind] || x.kind}</span>
          {c && <button type="button" className="ml-2 font-semibold hover:underline" onClick={() => openCompany(c.id)}>{brandName(c)}</button>}
        </div>
        <span className="text-xs text-muted-foreground">{ago(x.created_at)}</span>
      </div>
      <p className="text-[0.95rem]">{x.question}</p>
      {x.recommendation && <div className="flex gap-2.5 rounded-2xl bg-primary/5 p-3 text-sm"><Lightbulb className="size-4 shrink-0 text-primary" /><span><b>Agent recommends:</b> {x.recommendation}</span></div>}
      {x.draft_body && (
        <div className="space-y-2">
          <Input value={e.subject} onChange={(v) => setE({ ...e, subject: v.target.value })} aria-label="Subject" />
          <Textarea value={e.body} onChange={(v) => setE({ ...e, body: v.target.value })} className="min-h-52 font-mono text-sm" aria-label="Email" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy || !can("approver")} onClick={() => act("resolve", { id: x.id, action: "approve", subject: e.subject, body: e.body }, "Resolving").then((r: Any) => r && !r.ok && flash("Not queued", JSON.stringify(r.queued?.problems || r.queued?.reason), "error"))}><CheckCircle2 className="size-4" />{x.draft_body ? "Approve and queue this email" : "Mark handled"}</Button>
        <Button variant="outline" disabled={!!busy || !can("approver")} onClick={() => act("resolve", { id: x.id, action: "reject" }, "Rejecting")}>Reject</Button>
        {c && <Button variant="ghost" onClick={() => openCompany(c.id)}>Open company</Button>}
      </div>
    </article>
  );
}

export default function InboxPage() {
  const { data, act, busy, flash, can, openCompany } = useDesk();
  const exs = data.exceptions.filter((x: Any) => x.status === "open");
  const coName = (id: string) => brandName(data.companies.find((c: Any) => c.id === id) || { name: id || "General" });
  return (
    <>
      <PageHeader eyebrow="Agent A5 · decisions" title="Inbox" description="Only the calls a person should make: offers below your floor, exclusivity asks, missing emails, anything unusual. Sponsor replies land here too.">
        <Button variant="outline" disabled={!!busy || !data.settings.gmail} onClick={() => act("replies", {}, "Checking Gmail for replies").then((r: Any) => r && flash(`Checked ${r.checked} threads`, `${r.found} new replies`, "info"))}><RefreshCw className="size-4" />Check Gmail for replies</Button>
      </PageHeader>
      {!can("approver") && <p className="text-sm text-muted-foreground">Decisions here need an approver.</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Gavel className="size-5 text-primary" />Decisions <span className="text-muted-foreground num">{exs.length}</span></h2>
          {exs.map((x: Any) => <Decision key={x.id} x={x} />)}
          {!exs.length && <EmptyState icon={CheckCircle2} title="Nothing needs you">The agents handle the rest. You will see offers below your floor and anything unusual here.</EmptyState>}
        </div>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><MailCheck className="size-5 text-primary" />Replies <span className="text-muted-foreground num">{data.replies.length}</span></h2>
          <p className="text-sm text-muted-foreground">Read by fixed rules, not a model, so a sponsor email can never instruct the desk. Any reply stops cold mail to that whole company.</p>
          <div className="space-y-2">
            {data.replies.map((r: Any) => (
              <button key={r.id} type="button" onClick={() => r.company_id && openCompany(r.company_id)} className="w-full rounded-2xl border bg-card p-3 text-left text-sm transition hover:border-primary/50">
                <div className="flex flex-wrap items-center gap-2"><b>{coName(r.company_id)}</b><span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${CLASS_TONE[r.classification] || "bg-muted"}`}>{String(r.classification).replace("_", " ")}</span>{String(r.gmail_id).startsWith("sim-") && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem]">simulated</span>}<span className="ml-auto text-xs text-muted-foreground">{when(r.received_at)}</span></div>
                <p className="mt-1 text-muted-foreground">{r.summary}</p>
                {r.offer_inr ? <div className="mt-1 font-semibold text-gold-foreground dark:text-gold">Offered {inr(r.offer_inr)}</div> : null}
              </button>
            ))}
            {!data.replies.length && <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No replies yet. You can try one from any company's Next steps tab.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
