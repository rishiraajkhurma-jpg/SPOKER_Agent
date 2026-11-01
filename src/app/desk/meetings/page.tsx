"use client";

import { CalendarClock, Video } from "lucide-react";

import { CompanyAvatar, EmptyState, PageHeader } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName, when } from "@/components/desk/format";

export default function MeetingsPage() {
  const { data, openCompany } = useDesk();
  const co = (id: string) => data.companies.find((c: Any) => c.id === id) || { name: id };
  const list = [...data.meetings].sort((a: Any, b: Any) => String(b.start_at || b.created_at).localeCompare(String(a.start_at || a.created_at)));
  return (
    <>
      <PageHeader eyebrow="Agents A3 and A5" title="Meetings" description="Booked by A3 with Google Meet links and digested by A5 from your notes. Book or digest from a company's Next steps tab." />
      {!list.length ? <EmptyState icon={CalendarClock} title="No meetings yet">When a sponsor asks to talk, open the company and use Book a meeting.</EmptyState> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((m: Any) => (
            <article key={m.id} className="space-y-3 rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <CompanyAvatar name={brandName(co(m.company_id))} size={38} />
                <div className="min-w-0 flex-1"><button type="button" className="font-semibold hover:underline" onClick={() => openCompany(m.company_id)}>{brandName(co(m.company_id))}</button><div className="text-xs text-muted-foreground">Meeting {m.n}{m.start_at ? ` · ${when(m.start_at)}` : ""}{m.minutes ? ` · ${m.minutes} min` : ""}</div></div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{m.status}</span>
              </div>
              {m.meet_link && <a href={m.meet_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><Video className="size-4" />Join on Google Meet</a>}
              {m.digest && (
                <div className="space-y-1.5 rounded-2xl bg-muted/50 p-3 text-sm">
                  <div className="font-semibold capitalize">{m.digest.temperature} · {m.digest.summary}</div>
                  {m.digest.budget_signal && <div><b>Budget:</b> {m.digest.budget_signal}</div>}
                  {(m.digest.objections || []).length > 0 && <div><b>Objections:</b> {m.digest.objections.join("; ")}</div>}
                  {(m.digest.promises_by_us || []).map((p: Any, i: number) => <div key={i}><b>We promised:</b> {p.item}{p.due ? ` (by ${p.due})` : ""}</div>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
