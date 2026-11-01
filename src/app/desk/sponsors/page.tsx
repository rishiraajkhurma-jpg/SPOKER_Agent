"use client";

import { useState } from "react";

import { Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAvatar, PageHeader, StageBadge } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName } from "@/components/desk/format";

const SIGNED = ["MOU_SENT", "MOU_SIGNED", "PO_RECEIVED", "INVOICED", "PAID", "INKIND_CONFIRMED", "NURTURE"];

export default function SponsorsPage() {
  const { data, act, busy, flash, openCompany } = useDesk();
  const [news, setNews] = useState("");
  const signed = data.companies.filter((c: Any) => SIGNED.includes(c.stage));
  return (
    <>
      <PageHeader eyebrow="Agent A7 · Nurture" title="Sponsor updates" description="Signed sponsors renew when they feel part of the event. Write the fortnight's news once; A7 writes a personal update for each sponsor." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <label htmlFor="news" className="font-heading font-semibold">What happened this fortnight</label>
          <Textarea id="news" className="min-h-44" value={news} onChange={(e) => setNews(e.target.value)} placeholder={"Registrations crossed 12,400.\nSchedule for the 18 sports is live.\nYour sampling zone is confirmed next to the main ground."} />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!!busy || !news || !signed.length} onClick={() => act("nurture", { news }, "Writing sponsor updates").then((r: Any) => r && flash(`${r.drafted} updates drafted`, "Approve them in the Outbox.", "success"))}><Megaphone className="size-4" />Write updates for {signed.length} sponsor{signed.length === 1 ? "" : "s"}</Button>
            {!signed.length && <span className="text-sm text-muted-foreground">Updates start once a sponsor reaches the MOU stage.</span>}
          </div>
        </section>
        <section className="space-y-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading font-semibold">Signed and closing</h2>
          {signed.map((c: Any) => (
            <button key={c.id} type="button" onClick={() => openCompany(c.id)} className="flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left hover:border-primary/50"><CompanyAvatar name={brandName(c)} size={30} /><span className="flex-1 font-semibold">{brandName(c)}</span><StageBadge stage={c.stage} /></button>
          ))}
          {!signed.length && <p className="text-sm text-muted-foreground">None yet.</p>}
        </section>
      </div>
    </>
  );
}
