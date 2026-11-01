"use client";

import { useState } from "react";

import { cn } from "cn";
import { Check, ExternalLink, Lock, Pencil, RotateCcw, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/desk/bits";
import { BriefComposer } from "@/components/desk/brief-composer";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, api, host, inr, lakh } from "@/components/desk/format";
import { SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";

function Prefs() {
  const { data, act, busy, can } = useDesk();
  const e = data.event;
  const [cats, setCats] = useState<string[]>(e.sponsor_categories || []);
  const [brands, setBrands] = useState<string>((e.wanted_brands || []).join(", "));
  const dirty = JSON.stringify(cats) !== JSON.stringify(e.sponsor_categories || []) || brands !== (e.wanted_brands || []).join(", ");
  return (
    <section className="space-y-3 rounded-3xl border bg-card p-5">
      <div><h2 className="font-heading text-lg font-semibold">Sponsors you are looking for</h2><p className="text-sm text-muted-foreground">{cats.length ? "Discovery searches only these industries." : "None picked: the desk chooses industries that fit your event type."}</p></div>
      <div className="flex flex-wrap gap-1.5">
        {SPONSOR_CATEGORIES.map((c) => {
          const on = cats.includes(c.id);
          return <button key={c.id} type="button" aria-pressed={on} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])} className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}>{c.label}</button>;
        })}
      </div>
      <div className="space-y-1"><label htmlFor="pref-brands" className="text-xs font-medium text-muted-foreground">Brands you want (comma separated)</label><Input id="pref-brands" value={brands} onChange={(x) => setBrands(x.target.value)} placeholder="Red Bull, boAt, Decathlon" /></div>
      <Button size="sm" disabled={!dirty || !!busy || !can("operator")} onClick={() => act("prefs", { prefs: { categories: cats, brands: brands.split(",").map((b) => b.trim()).filter(Boolean) } }, "Saving what you are looking for")}>Save preferences</Button>
    </section>
  );
}

function Tiers() {
  const { data, act, busy, can, load, flash } = useDesk();
  const e = data.event;
  const [edit, setEdit] = useState(false);
  const [tiers, setTiers] = useState<Any[]>(e.tiers || []);
  const [floor, setFloor] = useState<number>(e.floor_inr || 0);
  const save = async () => {
    try { await api("/api/event", { profile: { ...e, tiers } }); await load(); setEdit(false); flash("Tiers saved", undefined, "success"); }
    catch (x: Any) { flash("Could not save", x.message, "error"); }
  };
  return (
    <section className="space-y-4 rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-heading text-lg font-semibold">What you sell</h2><p className="text-sm text-muted-foreground">{e.pricing_basis}</p></div>
        {!e.floor_locked && can("operator") && <Button variant="outline" size="sm" onClick={() => (edit ? save() : setEdit(true))}>{edit ? <><Check className="size-3.5" />Save tiers</> : <><Pencil className="size-3.5" />Edit tiers</>}</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map((t: Any, i: number) => (
          <div key={i} className={cn("flex flex-col gap-2 rounded-2xl border p-4", i === 0 ? "border-gold/60 bg-gold/10" : "bg-background")}>
            {edit ? (
              <>
                <Input value={t.name} onChange={(x) => setTiers(tiers.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)))} aria-label="Tier name" />
                <Input type="number" value={t.price_inr} onChange={(x) => setTiers(tiers.map((y, j) => (j === i ? { ...y, price_inr: Number(x.target.value) } : y)))} aria-label={`${t.name} price`} />
                <Textarea value={t.deliverables} onChange={(x) => setTiers(tiers.map((y, j) => (j === i ? { ...y, deliverables: x.target.value } : y)))} aria-label={`${t.name} deliverables`} />
              </>
            ) : (
              <>
                <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{t.name}</div>
                <div className="font-heading text-2xl font-bold num">{lakh(t.price_inr)}</div>
                <div className="text-xs text-muted-foreground">{t.deliverables}</div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className={cn("flex flex-wrap items-center gap-4 rounded-2xl p-4", e.floor_locked ? "bg-success/10" : "bg-primary/5 ring-1 ring-primary/20")}>
        <div className="min-w-56 flex-1">
          <div className="flex items-center gap-2 font-heading font-semibold"><Lock className="size-4" />Floor price {e.floor_locked && <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">Locked</span>}</div>
          <p className="text-sm text-muted-foreground">The smallest cash deal the agents may accept without you. It is never shown to sponsors. Below it, offers come to your Inbox with a trade-based counter.</p>
        </div>
        {e.floor_locked ? <div className="font-heading text-2xl font-bold num">{inr(e.floor_inr)}</div> : (
          <div className="flex items-center gap-2">
            <Input type="number" value={floor} onChange={(x) => setFloor(Number(x.target.value))} className="w-36" aria-label="Floor in rupees" />
            <Button disabled={!!busy || !floor || !can("approver")} onClick={() => act("lock_floor", { floor }, "Locking the floor")}><Lock className="size-4" />Lock at {lakh(floor)}</Button>
          </div>
        )}
      </div>
      {!can("approver") && !e.floor_locked && <p className="text-xs text-muted-foreground">Only an approver or admin can lock the floor.</p>}
    </section>
  );
}

export default function BriefPage() {
  const { data } = useDesk();
  const e = data.event;
  const [redo, setRedo] = useState(false);
  if (!e || redo) {
    return (
      <>
        <PageHeader eyebrow="Agent A0 · Package" title={e ? "Write a new brief" : "Let's set up your event"} description="A complete brief gives sharper prices, better-matched sponsors and stronger first emails. The meter on the right shows what is still missing.">
          {e && <Button variant="ghost" onClick={() => setRedo(false)}><X className="size-4" />Keep current brief</Button>}
        </PageHeader>
        <BriefComposer onDone={() => setRedo(false)} />
      </>
    );
  }
  const verified = (e.proof_items || []).filter((p: Any) => p.verified);
  return (
    <>
      <PageHeader eyebrow="Agent A0 · Package" title={e.name} description={e.one_line}>
        <Button variant="outline" onClick={() => setRedo(true)}><RotateCcw className="size-4" />New brief</Button>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold">The brief</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[150px_1fr]">
              {[
                ["Organiser", e.organizer], ["Dates", e.dates], ["City", e.city], ["Website", e.website ? <a key="w" className="text-primary hover:underline" href={e.website} target="_blank" rel="noreferrer">{host(e.website)}</a> : "—"],
                ["Audience", e.audience], ["Past sponsors", e.past_sponsors], ["Proof", verified.length ? verified.map((p: Any) => p.claim).join("; ") : e.proof],
                ["In-kind needs", e.inkind_needs], ["Signature", [e.sender?.name, e.sender?.title, e.sender?.org, e.postal_address].filter(Boolean).join(", ")],
              ].map(([k, v]: Any) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0">{v || "—"}</dd></div>)}
            </dl>
          </section>
          <Tiers />
        </div>
        <div className="space-y-6">
          <Prefs />
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-1 font-heading text-lg font-semibold">Sources</h2>
            <p className="mb-3 text-sm text-muted-foreground">Pages the desk read through Crustdata's web search.</p>
            <ul className="space-y-2.5 text-sm">
              {(e.sources || []).map((s: Any, i: number) => (
                <li key={i} className="min-w-0"><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary hover:underline"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">{s.title || host(s.url)}</span></a>{s.supports && <p className="line-clamp-2 text-xs text-muted-foreground">{s.supports}</p>}</li>
              ))}
              {!(e.sources || []).length && <li className="text-muted-foreground">No public pages found. Add proof and past sponsors yourself.</li>}
            </ul>
          </section>
          <section className="flex gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-5 text-sm"><Sparkles className="size-5 shrink-0 text-primary" /><p>Add last edition's real footfall and past sponsors to the brief: every offer email quotes them as proof.</p></section>
        </div>
      </div>
    </>
  );
}
