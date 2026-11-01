"use client";

import { useState } from "react";

import { cn } from "cn";
import { Activity, CheckCircle2, ShieldAlert, Trash2, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, api } from "@/components/desk/format";

function Health() {
  const [h, setH] = useState<Any>(null);
  const [run, setRun] = useState(false);
  const LABEL: Record<string, string> = { database: "Database", engine: "Agent engine", crustdata: "Crustdata", gmail: "Gmail" };
  return (
    <section className="space-y-3 rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-heading text-lg font-semibold">Check connections</h2><p className="text-sm text-muted-foreground">One free call to each service, so you know what works before running the agents.</p></div>
        <Button disabled={run} onClick={() => { setRun(true); api("/api/health").then(setH).catch((e) => setH({ error: { ok: false, detail: e.message } })).finally(() => setRun(false)); }}><Activity className="size-4" />{run ? "Checking..." : "Check now"}</Button>
      </div>
      {h && <div className="grid gap-2 sm:grid-cols-2">{Object.entries(h).map(([k, v]: Any) => (
        <div key={k} className={cn("flex gap-3 rounded-2xl border p-3", v.ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
          {v.ok ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <XCircle className="size-5 shrink-0 text-destructive" />}
          <div className="min-w-0"><div className="font-semibold">{LABEL[k] || k}</div><div className="text-xs break-words text-muted-foreground">{v.detail}</div></div>
        </div>
      ))}</div>}
    </section>
  );
}

export default function SettingsPage() {
  const { data, act, flash, can } = useDesk();
  const s = data.settings;
  const [nu, setNu] = useState({ email: "", name: "", role: "operator", password: "" });
  const [v, setV] = useState({ cap_new_per_day: s.cap_new_per_day, cap_total_per_day: s.cap_total_per_day, spacing_sec: s.spacing_sec, organiser_permission: s.permission });
  const [email, setEmail] = useState("");
  const [confirmReset, setConfirmReset] = useState("");
  return (
    <>
      <PageHeader eyebrow="Desk" title="Settings" description="Connections, the rules the agents cannot break, and your team." />
      <Health />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Connections</h2>
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[130px_1fr]">
            <dt className="text-muted-foreground">Engine</dt><dd>{s.engine}</dd>
            <dt className="text-muted-foreground">Company data</dt><dd>{s.crustdata ? <span className="font-semibold text-success">Crustdata connected</span> : <span className="text-destructive">Add CRUSTDATA_API_KEY in Vercel: it is the only key the desk needs.</span>}</dd>
            <dt className="text-muted-foreground">Gmail + Calendar</dt>
            <dd>{s.gmail ? <span>{s.gmail} {can("admin") && <><a className="text-primary hover:underline" href="/api/google/auth">Reconnect</a> · <button type="button" className="text-destructive hover:underline" onClick={() => act("google_disconnect", {}, "Disconnecting Google")}>Disconnect</button></>}</span> : s.googleApp ? <Button size="sm" nativeButton={false} render={<a href="/api/google/auth" />}>Connect Google</Button> : <span className="text-muted-foreground">Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then connect.</span>}</dd>
            <dt className="text-muted-foreground">Assistant</dt><dd>Answers from the desk's own data. Optional: a free GEMINI_API_KEY makes replies more conversational.</dd>
          </dl>
        </section>
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Sending rules</h2>
          <p className="text-sm text-muted-foreground">Approvers: {s.approvers || "none yet"}. Approval rights come from each person's role.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["cap_new_per_day", "New cold emails a day"], ["cap_total_per_day", "Total emails a day"], ["spacing_sec", "Seconds between sends"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1"><label htmlFor={k} className="text-xs font-medium text-muted-foreground">{l}</label><Input id={k} value={(v as Any)[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="space-y-1"><label htmlFor="perm" className="text-xs font-medium text-muted-foreground">Organisers' written permission to email companies in the event's name (cold emails wait until this is filled)</label><Input id="perm" value={v.organiser_permission} placeholder="e.g. Sports Council email, 31 Oct 2026" onChange={(e) => setV({ ...v, organiser_permission: e.target.value })} /></div>
          <Button disabled={!can("admin")} onClick={() => act("settings", v, "Saving").then((r: Any) => r && flash("Rules saved", undefined, "success"))}>Save rules</Button>
        </section>
      </div>
      {can("admin") && (
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <div><h2 className="font-heading text-lg font-semibold">People and roles</h2><p className="text-sm text-muted-foreground">Admin: everything. Approver: approves and sends, locks the floor, decides exceptions. Operator: runs agents, edits drafts. Read-only: views.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>{(data.users || []).map((u: Any) => (
              <tr key={u.id} className="border-t">
                <td className="py-2 font-medium">{u.name}{u.disabled ? <span className="ml-2 text-xs text-destructive">disabled</span> : null}</td><td>{u.email}</td>
                <td><NativeSelect value={u.role} onChange={(e) => act("user_update", { id: u.id, role: e.target.value }, "Changing role")} aria-label={`Role for ${u.name}`}>{["admin", "approver", "operator", "readonly"].map((r) => <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>)}</NativeSelect></td>
                <td className="space-x-2 text-right"><Button size="xs" variant="ghost" onClick={() => act("sessions_revoke", { user_id: u.id }, "Signing out").then((r: Any) => r && flash(`${u.name} signed out everywhere`))}>Sign out everywhere</Button><Button size="xs" variant="ghost" onClick={() => act("user_update", { id: u.id, disabled: !u.disabled }, u.disabled ? "Enabling" : "Disabling")}>{u.disabled ? "Enable" : "Disable"}</Button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); act("user_add", nu, "Adding").then((r: Any) => { if (r) { flash(`Added ${nu.name}`, undefined, "success"); setNu({ email: "", name: "", role: "operator", password: "" }); } }); }}>
            <Input placeholder="Name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} aria-label="New person's name" />
            <Input placeholder="Work email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} aria-label="New person's email" />
            <NativeSelect value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} aria-label="Role">{["approver", "operator", "readonly", "admin"].map((r) => <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>)}</NativeSelect>
            <Input type="password" placeholder="Temporary password (10+)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} aria-label="Temporary password" />
            <Button type="submit" disabled={!nu.email || !nu.name || nu.password.length < 10}><UserPlus className="size-4" />Add</Button>
          </form>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">People and data</h2>
          <p className="text-sm text-muted-foreground">Opt-outs are permanent. Erasing removes a person's details and keeps only a hash so they are never contacted again (DPDP Act 2023).</p>
          <div className="flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
            <Button variant="outline" disabled={!email || !can("approver")} onClick={() => act("suppress", { email }, "Suppressing").then(() => flash("Will never be emailed"))}>Never email</Button>
            <Button variant="destructive" disabled={!email || !can("admin")} onClick={() => act("forget", { email }, "Erasing").then((r: Any) => r && flash(`Erased ${r.erased}`))}><Trash2 className="size-4" />Erase their data</Button></div>
        </section>
        {can("admin") && (
          <section className="space-y-3 rounded-3xl border border-destructive/30 bg-card p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><ShieldAlert className="size-5 text-destructive" />Start over</h2>
            <p className="text-sm text-muted-foreground">Clears every company, contact, email, meeting, deck and deal, and the event brief. Settings and the Google connection stay. Type RESET to confirm.</p>
            <div className="flex gap-2"><Input className="max-w-40" value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} placeholder="RESET" aria-label="Type RESET to confirm" />
              <Button variant="destructive" disabled={confirmReset !== "RESET"} onClick={() => act("reset", { confirm: "RESET" }, "Clearing the desk").then((r: Any) => { if (r) { flash("Desk cleared"); setConfirmReset(""); } })}>Reset desk</Button></div>
          </section>
        )}
      </div>
    </>
  );
}
