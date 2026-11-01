"use client";

import { cn } from "cn";

import { CompanyAvatar, PageHeader, PriorityBadge, StageBadge } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName, COLUMNS } from "@/components/desk/format";

const ACCENT = ["bg-primary", "bg-info", "bg-gold", "bg-chart-4", "bg-chart-3", "bg-success", "bg-muted-foreground"];

export default function PipelinePage() {
  const { data, openCompany } = useDesk();
  const cos: Any[] = data.companies;
  return (
    <>
      <PageHeader eyebrow="Every deal by stage" title="Pipeline" description="Each column is a step in the deal. Agents move companies forward as things happen; open a card to see the deal room." />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="flex min-w-max gap-4">
          {COLUMNS.map((col, ci) => {
            const items = cos.filter((c) => col.stages.includes(c.stage)).sort((a, b) => (b.intersection ?? -1) - (a.intersection ?? -1));
            return (
              <section key={col.title} className="flex w-72 shrink-0 flex-col rounded-3xl border bg-muted/40" aria-label={col.title}>
                <header className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <span className={cn("size-2.5 rounded-full", ACCENT[ci])} />
                  <h2 className="font-heading font-semibold">{col.title}</h2>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-bold num">{items.length}</span>
                </header>
                <div className="px-4 pb-2 text-[0.7rem] text-muted-foreground">{col.hint}</div>
                <div className="flex max-h-[calc(100dvh-16rem)] flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 scrollbar-thin">
                  {items.map((c) => (
                    <button key={c.id} type="button" onClick={() => openCompany(c.id)} className="rounded-2xl border bg-card p-3 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
                      <div className="flex items-center gap-2.5">
                        <CompanyAvatar name={brandName(c)} size={32} />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{brandName(c)}</div><div className="truncate text-[0.7rem] text-muted-foreground">{c.reasons?.about?.industry || c.domain}</div></div>
                        <PriorityBadge p={c.priority} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.reasons?.why_fit?.[1] || c.angle || c.why_now}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <StageBadge stage={c.stage} />
                        {c.intersection != null && <span className="text-[0.7rem] font-semibold num">fit {c.intersection}</span>}
                        {c.price_range && <span className="ml-auto truncate text-[0.7rem] font-semibold text-gold-foreground dark:text-gold">{c.price_range.replace("INR ", "₹")}</span>}
                      </div>
                    </button>
                  ))}
                  {!items.length && <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Nothing here yet</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
