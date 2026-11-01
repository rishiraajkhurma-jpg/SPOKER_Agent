"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "cn";
import { Check, CircleDashed, Lightbulb, Loader2, Plus, Sparkles, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readBrief } from "@/lib/brief-parse";
import { SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";

import { RichText } from "./bits";
import { useDesk } from "./desk-provider";
import type { Any } from "./format";

const EXAMPLE = "Aavhan 2027, IIT Bombay, 24 to 26 Jan 2027, Mumbai, 15,000 footfall, college athletes and students from 120 colleges, goal ₹50 lakh, IIT Bombay Gymkhana, Powai, Mumbai 400076";
const ADD: Record<string, string> = {
  name: "Your Event 2027", organiser: "Organising institute or club", dates: "dates like 24 to 26 Jan 2027", city: "city", footfall: "15,000 footfall",
  audience: "who attends, e.g. college students and young professionals", goal: "goal ₹50 lakh", address: "postal address with 6-digit PIN",
};

export function BriefComposer({ onDone, initial = "" }: { onDone?: () => void; initial?: string }) {
  const { act, busy, me, data } = useDesk();
  const [text, setText] = useState(initial);
  const [cats, setCats] = useState<string[]>(data?.event?.sponsor_categories || []);
  const [brands, setBrands] = useState<string[]>(data?.event?.wanted_brands || []);
  const [brandIn, setBrandIn] = useState("");
  const [skip, setSkip] = useState(false);
  const [sender, setSender] = useState({ name: me?.name || "", title: "", phone: "" });
  const [clarify, setClarify] = useState<Any>(null);
  const [answers, setAnswers] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const read = useMemo(() => readBrief(text), [text]);
  const ringC = 2 * Math.PI * 34;
  const tone = read.score >= 80 ? "var(--success)" : read.score >= 55 ? "var(--primary)" : read.score >= 30 ? "var(--gold)" : "var(--destructive)";

  function add(key: string) {
    const sep = text.trim() ? (text.trim().endsWith(",") ? " " : ", ") : "";
    const snippet = ADD[key];
    const next = text.trimEnd() + sep + snippet;
    setText(next);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      const start = next.length - snippet.length;
      el.setSelectionRange(start, next.length);
    });
  }
  function addBrand() {
    const b = brandIn.split(",").map((x) => x.trim()).filter(Boolean);
    if (b.length) setBrands([...new Set([...brands, ...b])].slice(0, 25));
    setBrandIn("");
  }
  async function submit(withAnswers = "") {
    const parts = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const addr = parts.find((p) => /\b\d{6}\b/.test(p));
    const audience = read.fields.find((f) => f.key === "audience")?.found;
    const ans = [withAnswers, addr ? `Address: ${parts.slice(Math.max(0, parts.indexOf(addr) - 2), parts.indexOf(addr) + 1).join(", ")}` : "", audience ? `Audience: ${audience}` : ""].filter(Boolean).join("\n");
    const r = await act("brief", { line: text.replace(/\n+/g, ", "), answers: ans, sender, prefs: skip ? { categories: [], brands } : { categories: cats, brands } }, "Packaging your event: web check, tiers and floor");
    if (r?.clarify) { setClarify(r.clarify); return; }
    if (r?.profile) { setClarify(null); onDone?.(); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3 rounded-3xl border bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary uppercase">Step 1 · Your event</div>
              <h2 className="font-heading text-xl font-bold">Describe the event like you would to a sponsor</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}><Wand2 className="size-3.5" />Use an example</Button>
          </div>
          <Textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Describe your event"
            placeholder="Event name and year, organiser, dates, city, expected footfall, who attends, your goal in ₹, postal address with PIN"
            className="min-h-36 resize-y rounded-2xl text-base leading-relaxed" />
          <div className="flex flex-wrap gap-1.5">
            {read.missing.slice(0, 6).map((f) => (
              <button key={f.key} type="button" onClick={() => add(f.key)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10">
                <Plus className="size-3" />{f.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-1"><label htmlFor="snd-name" className="text-xs font-medium text-muted-foreground">Your name (signs the emails) *</label><Input id="snd-name" value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} /></div>
            <div className="space-y-1"><label htmlFor="snd-title" className="text-xs font-medium text-muted-foreground">Your title</label><Input id="snd-title" value={sender.title} onChange={(e) => setSender({ ...sender, title: e.target.value })} placeholder="Head, Sponsorships" /></div>
            <div className="space-y-1"><label htmlFor="snd-phone" className="text-xs font-medium text-muted-foreground">Phone for the signature</label><Input id="snd-phone" value={sender.phone} onChange={(e) => setSender({ ...sender, phone: e.target.value })} /></div>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border bg-card p-5 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center gap-4">
            <div className="relative grid size-20 shrink-0 place-items-center">
              <svg width="80" height="80" className="-rotate-90" aria-hidden><circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="7" /><circle cx="40" cy="40" r="34" fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - read.score / 100)} className="transition-all duration-500" /></svg>
              <span className="absolute font-heading text-xl font-bold num">{read.score}</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Brief quality</div>
              <div className="font-heading text-lg font-bold">{read.level}</div>
              <div className="text-xs text-muted-foreground">{read.score >= 80 ? "Great first impression for sponsors." : "Fill the gaps for sharper pricing and pitches."}</div>
            </div>
          </div>
          <ul className="space-y-2">
            {read.fields.map((f) => (
              <li key={f.key} className="flex gap-2.5 text-sm">
                {f.found ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className={cn("font-medium", !f.found && "text-muted-foreground")}>{f.label}</span>{!f.found && <button type="button" onClick={() => add(f.key)} className="text-xs font-semibold text-primary hover:underline">Add</button>}</div>
                  <div className="truncate text-xs text-muted-foreground">{f.found || f.why}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="space-y-4 rounded-3xl border bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary uppercase">Step 2 · Optional</div>
            <h2 className="font-heading text-xl font-bold">What sponsors are you looking for?</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Pick categories to focus the search, and name brands you already want. You can change this later.</p>
          </div>
          <button type="button" onClick={() => setSkip(!skip)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", skip ? "border-gold bg-gold/20 text-gold-foreground dark:text-gold" : "hover:bg-muted")}>
            {skip ? "Skipped: the desk will choose" : "Skip this step"}
          </button>
        </div>
        {skip ? (
          <div className="flex gap-3 rounded-2xl bg-gold/10 p-4 text-sm"><Lightbulb className="size-5 shrink-0 text-gold" /><p>The desk will pick industries that usually sponsor this kind of event. That works, but matches are broader and you may see a few less relevant companies. Choosing categories usually gives a sharper first list.</p></div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {SPONSOR_CATEGORIES.map((c) => {
                const on = cats.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])}
                    className={cn("flex items-start gap-2.5 rounded-2xl border p-3 text-left transition", on ? "border-primary bg-primary/10 shadow-sm" : "hover:border-primary/40 hover:bg-muted/50")}>
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "")}>{on && <Check className="size-3.5" />}</span>
                    <span className="min-w-0"><span className="block text-sm font-semibold">{c.label}</span><span className="block text-xs text-muted-foreground">{c.hint}</span></span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <label htmlFor="brand-in" className="text-sm font-semibold">Brands you have in mind</label>
              <form onSubmit={(e) => { e.preventDefault(); addBrand(); }} className="flex gap-2">
                <Input id="brand-in" value={brandIn} onChange={(e) => setBrandIn(e.target.value)} placeholder="e.g. Red Bull, boAt, Decathlon (comma separated)" />
                <Button type="submit" variant="outline" disabled={!brandIn.trim()}>Add</Button>
              </form>
              {!!brands.length && (
                <div className="flex flex-wrap gap-1.5">
                  {brands.map((b) => <span key={b} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{b}<button type="button" aria-label={`Remove ${b}`} onClick={() => setBrands(brands.filter((x) => x !== b))}><X className="size-3" /></button></span>)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">The desk looks these up on Crustdata (free) and puts them on your list first.</p>
            </div>
          </>
        )}
      </section>

      {clarify && (
        <section className="space-y-3 rounded-3xl border border-gold/50 bg-gold/10 p-5">
          <div className="flex items-center gap-2 font-heading font-semibold"><Sparkles className="size-4 text-gold" />The desk needs a little more</div>
          <p className="text-sm">{clarify.found}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">{(clarify.questions || []).map((q: string, i: number) => <li key={i}>{q}</li>)}</ol>
          <Textarea value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="Answer here: what kind of event, correct spelling, organiser, address..." aria-label="Your answers" />
          <Button disabled={!!busy || !answers.trim()} onClick={() => submit(answers)}>Answer and package</Button>
        </section>
      )}

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 pl-5 shadow-lg backdrop-blur sm:mr-60">
        <div className="text-sm">
          {read.score < 55 ? <RichText text={`**${read.missing.length} details missing.** You can still package it, but prices and pitches will be rougher.`} /> : <RichText text={`**Looking good.** ${!skip && cats.length ? `Searching ${cats.length} categor${cats.length > 1 ? "ies" : "y"}${brands.length ? ` and ${brands.length} brand${brands.length > 1 ? "s" : ""}` : ""}.` : "The desk will choose the industries."}`} />}
        </div>
        <Button size="lg" className="h-10 px-5" disabled={!!busy || !read.fields[0].found || !sender.name} onClick={() => submit()}>
          {busy?.op === "brief" ? <><Loader2 className="size-4 animate-spin" />Packaging...</> : <><Sparkles className="size-4" />Package my event</>}
        </Button>
      </div>
    </div>
  );
}
