"use client";

import { Suspense, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { ArrowRight, Bot, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/components/desk/format";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/desk";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setWait(true); setErr("");
    try { await api("/api/login", { email, password }); router.replace(next.startsWith("/") ? next : "/desk"); }
    catch (x: any) { setErr(x.message); }
    finally { setWait(false); }
  }
  return (
    <form onSubmit={go} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{err}</p>}
      <Button type="submit" size="lg" className="h-10 w-full" disabled={wait || !email || !password}>{wait ? "Signing in..." : <>Sign in<ArrowRight className="size-4" /></>}</Button>
      <p className="text-xs text-muted-foreground">First sign-in on a new desk: your email plus the team password creates the admin account.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-gold/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-10 size-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gold font-heading text-xl font-extrabold text-gold-foreground">S</div>
          <div className="font-heading text-xl font-bold">SponsorDesk</div>
        </div>
        <div className="relative max-w-lg space-y-6">
          <h1 className="font-heading text-5xl leading-[1.05] font-bold text-balance">Your sponsorship team, minus the cold-calling.</h1>
          <p className="text-lg text-white/80">Eight agents find sponsors with fresh budgets, write priced offers and negotiate inside your floor. You approve what matters.</p>
          <ul className="space-y-3 text-sm text-white/85">
            <li className="flex gap-3"><Sparkles className="size-5 shrink-0 text-gold" />Real company data from Crustdata. No AI key needed.</li>
            <li className="flex gap-3"><Bot className="size-5 shrink-0 text-gold" />Ask the desk anything while the agents work.</li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-gold" />Nothing is sent until a named person approves it.</li>
          </ul>
        </div>
        <div className="relative text-xs text-white/60">Built for college fests, conferences, hackathons and meetups.</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-xl bg-gold font-heading text-lg font-extrabold text-gold-foreground">S</div><div className="font-heading text-lg font-bold">SponsorDesk</div></div>
          <div><h2 className="font-heading text-2xl font-bold">Sign in to your desk</h2><p className="text-sm text-muted-foreground">Use the email and password your admin gave you.</p></div>
          <Suspense><LoginForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
