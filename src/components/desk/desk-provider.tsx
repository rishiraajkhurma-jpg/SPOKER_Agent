"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";

import { type Any, api } from "./format";

type Busy = { op: string; label: string } | null;
type Progress = { done: number; total: number; label: string } | null;
type Desk = {
  data: Any;
  load: () => Promise<void>;
  act: (op: string, body?: Any, label?: string, reload?: boolean) => Promise<Any>;
  busy: Busy;
  progress: Progress;
  setProgress: (p: Progress) => void;
  flash: (title: string, description?: string, type?: "success" | "error" | "info") => void;
  openCompany: (id: string) => void;
  companyId: string;
  closeCompany: () => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  ask: (q: string) => void;
  pendingQuestion: string;
  clearPending: () => void;
  me: Any;
  can: (r: "readonly" | "operator" | "approver" | "admin") => boolean;
  autopilot: (count: number) => Promise<void>;
};

const Ctx = createContext<Desk | null>(null);
export const useDesk = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDesk outside DeskProvider");
  return c;
};
const RANK: Record<string, number> = { readonly: 0, operator: 1, approver: 2, admin: 3 };

export function DeskProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState<Any>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [companyId, setCompanyId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingQuestion, setPending] = useState("");
  const loading = useRef(false);

  const flash = useCallback((title: string, description?: string, type: "success" | "error" | "info" = "info") => {
    toast.add({ title, description, type });
  }, []);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try { setData(await api("/api/state")); }
    catch (e: Any) { if (e.code !== 401) flash("Could not load the desk", e.message, "error"); }
    finally { loading.current = false; }
  }, [flash]);

  const act = useCallback(async (op: string, body: Any = {}, label = "", reload = true) => {
    setBusy({ op, label: label || op });
    try {
      const r = await api("/api/act", { op, ...body });
      if (reload) await load();
      return r;
    } catch (e: Any) {
      if (e.code !== 401) flash("That did not work", e.message, "error");
      return null;
    } finally { setBusy(null); }
  }, [load, flash]);

  /** Discover, then score each company one by one (one Crustdata call at a time keeps within rate limits). */
  const autopilot = useCallback(async (count: number) => {
    const r = await act("discover", { count }, `Finding ${count} sponsors with fresh budget signals`);
    if (!r) return;
    const fresh = await api("/api/state").catch(() => null);
    const ids: string[] = [...(r.added || []), ...((fresh?.companies || []) as Any[]).filter((c) => c.stage === "PROSPECT" && !(r.added || []).includes(c.id)).map((c) => c.id)];
    for (let i = 0; i < ids.length; i++) {
      const name = (fresh?.companies || []).find((c: Any) => c.id === ids[i])?.name || ids[i];
      setProgress({ done: i, total: ids.length, label: `Scoring ${name}: both sides, decision maker, priced offer` });
      try { await api("/api/act", { op: "analyze", company_id: ids[i] }); } catch (err: Any) { if (err.code !== 401) flash(`Could not score ${name}`, err.message, "error"); }
      await load();
    }
    setProgress(null);
    flash("Autopilot finished", `${ids.length} companies researched. Offers are waiting in the Outbox.`, "success");
  }, [act, load, flash]);

  useEffect(() => {
    const out = () => { setData(null); router.replace(`/login?next=${encodeURIComponent(path || "/desk")}`); };
    window.addEventListener("sd-signed-out", out);
    return () => window.removeEventListener("sd-signed-out", out);
  }, [router, path]);
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get("gmail");
    if (q) { flash(q === "connected" ? "Google connected" : "Google", q === "connected" ? "Gmail and Calendar are live." : q, q === "connected" ? "success" : "error"); window.history.replaceState({}, "", window.location.pathname); }
  }, [load, flash]);
  // Live log while agents work, so the activity feed and agent flow move in real time.
  useEffect(() => {
    if (!busy && !progress) return;
    const t = setInterval(async () => {
      try { const r = await api("/api/state?log_only=1"); setData((d: Any) => (d ? { ...d, log: r.log } : d)); } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(t);
  }, [busy, progress]);

  const me = data?.me || { role: "readonly" };
  const value = useMemo<Desk>(() => ({
    data, load, act, busy, progress, setProgress, flash, me,
    can: (r) => (RANK[me.role] ?? 0) >= RANK[r],
    openCompany: (id) => setCompanyId(id), companyId, closeCompany: () => setCompanyId(""),
    chatOpen, setChatOpen,
    ask: (q) => { setPending(q); setChatOpen(true); }, pendingQuestion, clearPending: () => setPending(""),
    autopilot,
  }), [data, load, act, busy, progress, flash, me, companyId, chatOpen, pendingQuestion, autopilot]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
