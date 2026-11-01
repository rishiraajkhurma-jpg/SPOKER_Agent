"use client";

import { useEffect, useState } from "react";

import { cn } from "cn";
import { Check, CheckCheck, Inbox as InboxIcon, Info, Pencil, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAvatar, EmptyState, PageHeader } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, ago, brandName, when } from "@/components/desk/format";

const kindOf = (m: Any) => (m.sequence === "cold" ? (m.step === 0 ? "Priced offer" : `Follow-up ${m.step}`) : m.sequence === "reply" ? "Reply" : m.sequence === "meeting" ? "Meeting" : m.sequence === "recap" ? "Recap" : m.sequence === "mou" ? "MOU" : m.sequence === "nurture" ? "Update" : m.sequence);

export default function OutboxPage() {
  const { data, act, busy, flash, can, openCompany } = useDesk();
  const approver = can("approver");
  const msgs: Any[] = data.messages;
  const sets = {
    draft: msgs.filter((m) => m.status === "drafted"),
    queued: msgs.filter((m) => ["approved", "claimed", "failed"].includes(m.status)),
    check: msgs.filter((m) => ["send_unknown", "needs_manual_review"].includes(m.status)),
    sent: msgs.filter((m) => m.status === "sent"),
  };
  const [tab, setTab] = useState<keyof typeof sets>("draft");
  const list = sets[tab];
  const [sel, setSel] = useState<string>("");
  const [edit, setEdit] = useState<Any>(null);
  useEffect(() => { if (!list.find((m) => m.key === sel)) setSel(list[0]?.key || ""); }, [tab, list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = list.find((m) => m.key === sel);
  const co = (id: string) => data.companies.find((c: Any) => c.id === id) || { name: id };

  return (
    <>
      <PageHeader eyebrow="Email agent" title="Outbox" description="Nothing reaches a sponsor until a named approver says yes. Every draft has already passed the style and compliance check.">
        {sets.draft.length > 1 && <Button variant="outline" disabled={!!busy || !approver} onClick={() => act("approve_many", { keys: sets.draft.map((m) => m.key) }, "Approving").then((r: Any) => r && flash(`Approved ${r.results.filter((x: Any) => x.ok).length} emails`, undefined, "success"))}><CheckCheck className="size-4" />Approve all {sets.draft.length}</Button>}
        <Button disabled={!!busy || !approver} onClick={() => act("send", {}, "Sending approved emails").then((r: Any) => r && flash(`Sent ${r.sent}`, (r.notes || []).join(" "), "info"))}><Send className="size-4" />Send approved now</Button>
      </PageHeader>
      {!data.settings.gmail && <div className="flex gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-sm"><Info className="size-5 shrink-0 text-gold" /><span><b>Draft mode.</b> Gmail is not connected, so approved emails wait here. Connect Google in Settings to send from your own mailbox.</span></div>}
      {!approver && <p className="text-sm text-muted-foreground">Your role ({data.me?.role}) can edit drafts. An approver sends them.</p>}

      <div className="grid min-h-[60vh] overflow-hidden rounded-3xl border bg-card lg:grid-cols-[360px_1fr]">
        <div className="flex min-w-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="flex gap-1 border-b p-2">
            {([["draft", "To approve"], ["queued", "Queued"], ["check", "Check"], ["sent", "Sent"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l} <span className="num opacity-80">{sets[k].length}</span></button>
            ))}
          </div>
          <div className="max-h-[70vh] flex-1 overflow-y-auto">
            {list.map((m) => (
              <button key={m.key} type="button" onClick={() => { setSel(m.key); setEdit(null); }} className={cn("flex w-full gap-3 border-b p-3 text-left transition", sel === m.key ? "bg-primary/8" : "hover:bg-muted/50")}>
                <CompanyAvatar name={brandName(co(m.company_id))} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{brandName(co(m.company_id))}</span><span className="ml-auto shrink-0 text-[0.65rem] text-muted-foreground">{ago(m.sent_at || m.created_at)}</span></div>
                  <div className="truncate text-xs">{m.subject}</div>
                  <div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-muted px-1.5 py-px text-[0.6rem] font-bold uppercase">{kindOf(m)}</span><span className="truncate text-[0.7rem] text-muted-foreground">{m.to_email}</span></div>
                </div>
              </button>
            ))}
            {!list.length && <div className="p-8 text-center text-sm text-muted-foreground">{tab === "draft" ? "Nothing waiting for you." : "Empty."}</div>}
          </div>
        </div>
        <div className="min-w-0 p-5 md:p-7">
          {!cur ? (
            <EmptyState icon={InboxIcon} title={tab === "draft" ? "Nothing to approve" : "Pick an email"}>{tab === "draft" ? "The agents put every draft here before it can go out." : "Choose one on the left to read it."}</EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => openCompany(cur.company_id)}>{co(cur.company_id).name}</button>
                  <h2 className="font-heading text-xl font-bold">{edit ? "Editing draft" : cur.subject}</h2>
                  <div className="text-sm text-muted-foreground">To {cur.to_email} · {kindOf(cur)} · {cur.scheduled_for ? `due ${when(cur.scheduled_for)}` : when(cur.created_at)}</div>
                </div>
                {tab === "draft" && !edit && (
                  <div className="flex gap-2">
                    <Button disabled={!!busy || !approver} onClick={() => act("approve", { key: cur.key }, "Approving").then((r: Any) => r && !r.ok && flash("Not approved", r.reason, "error"))}><Check className="size-4" />Approve</Button>
                    <Button variant="outline" onClick={() => setEdit({ subject: cur.subject, body: cur.body })}><Pencil className="size-4" />Edit</Button>
                    {approver && <Button variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => act("reject", { key: cur.key }, "Rejecting")}><Trash2 className="size-4" />Reject</Button>}
                  </div>
                )}
              </div>
              {tab === "check" && (
                <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                  <p>Gmail may or may not have delivered this email. It is never resent automatically. {cur.status === "send_unknown" ? "The next daily cycle checks your Sent folder." : "Look in your Gmail Sent folder, then choose."}</p>
                  {approver && <div className="flex gap-2"><Button size="sm" disabled={!!busy} onClick={() => act("delivery", { key: cur.key, outcome: "sent" }, "Marking as sent")}>It was sent</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("delivery", { key: cur.key, outcome: "resend" }, "Queuing a resend")}>Not in Sent: resend</Button></div>}
                </div>
              )}
              {edit ? (
                <div className="space-y-3">
                  <Input value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} aria-label="Subject" />
                  <Textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="min-h-80 font-mono text-sm" aria-label="Body" />
                  <div className="flex gap-2">
                    <Button onClick={() => act("edit", { key: cur.key, ...edit }, "Saving").then((r: Any) => { if (r?.ok) setEdit(null); else if (r) flash("Fix these first", (r.problems || [r.reason]).join("; "), "error"); })}>Save (style is re-checked)</Button>
                    <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <article className="rounded-2xl border bg-background p-5 shadow-xs">
                  <div className="mb-3 border-b pb-3 text-sm"><div className="font-semibold">{cur.subject}</div><div className="text-xs text-muted-foreground">to {cur.to_email}</div></div>
                  <pre className="font-sans text-[0.92rem] leading-relaxed whitespace-pre-wrap">{cur.body}</pre>
                </article>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
