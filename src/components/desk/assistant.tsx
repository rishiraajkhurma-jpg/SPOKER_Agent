"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { ArrowUp, Bot, Loader2, RotateCcw, Sparkles, X } from "lucide-react";

import { RichText } from "./bits";
import { useDesk } from "./desk-provider";
import { type Any, AGENTS, api, OP_AGENT } from "./format";

type Msg = { role: "user" | "assistant"; text: string; actions?: Any[]; suggestions?: string[]; engine?: string; t: number };

export function Assistant() {
  const { chatOpen, setChatOpen, pendingQuestion, clearPending, busy, progress, openCompany, data } = useDesk();
  const router = useRouter();
  const path = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [unread, setUnread] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasWorking = useRef(false);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setMsgs((m) => [...m, { role: "user", text: q, t: Date.now() }]);
    setInput("");
    setThinking(true);
    try {
      const r = await api("/api/assist", { message: q, path });
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, actions: r.actions, suggestions: r.suggestions, engine: r.engine, t: Date.now() }]);
    } catch (e: Any) {
      setMsgs((m) => [...m, { role: "assistant", text: `I could not reach the desk: ${e.message}`, t: Date.now() }]);
    } finally { setThinking(false); }
  }, [path, thinking]);

  // First open: brief the user automatically.
  useEffect(() => { if (chatOpen && !msgs.length && !pendingQuestion) send("What's going on?"); }, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (chatOpen && pendingQuestion) { send(pendingQuestion); clearPending(); } }, [chatOpen, pendingQuestion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (chatOpen) { setUnread(false); setTimeout(() => inputRef.current?.focus(), 150); } }, [chatOpen]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs, thinking]);
  // When agents finish a job while the chat is closed, show a dot on the launcher.
  useEffect(() => {
    const working = !!(busy || progress);
    if (wasWorking.current && !working && !chatOpen) setUnread(true);
    wasWorking.current = working;
  }, [busy, progress, chatOpen]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && chatOpen) setChatOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [chatOpen, setChatOpen]);

  const agent = busy ? AGENTS.find((a) => a.id === OP_AGENT[busy.op]) : progress ? AGENTS[1] : null;
  const last = msgs[msgs.length - 1];
  const chips = last?.role === "assistant" && last.suggestions?.length ? last.suggestions : ["What's going on?", "What should I do next?", "Who should I pitch first?", "How much does it cost?"];

  return (
    <>
      {!chatOpen && (
        <button type="button" onClick={() => setChatOpen(true)} aria-label="Ask the desk assistant"
          className="group fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-full bg-hero py-2 pr-4 pl-2 text-white shadow-xl ring-1 ring-white/15 transition hover:scale-[1.03]">
          <span className={cn("relative grid size-9 place-items-center rounded-full bg-gold text-gold-foreground", (busy || progress) && "animate-ring")}>
            <Sparkles className="size-4.5" />
            {unread && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-rose-500" />}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm font-semibold">Ask the desk</span>
            <span className="block text-[0.68rem] text-white/70">{busy || progress ? `${agent?.name || "Agent"} is working` : unread ? "Agents finished: ask what happened" : "What's going on? Ask me"}</span>
          </span>
        </button>
      )}
      {chatOpen && (
        <section role="dialog" aria-label="Desk assistant"
          className="fixed inset-x-2 bottom-2 z-50 flex h-[min(680px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl animate-rise sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[420px]">
          <header className="relative overflow-hidden bg-hero px-4 pt-4 pb-3 text-white">
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-gold/30 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-gold text-gold-foreground shadow-lg"><Bot className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-base font-bold">Desk assistant</div>
                <div className="flex items-center gap-1.5 text-xs text-white/75">
                  <span className={cn("size-1.5 rounded-full", busy || progress ? "animate-pulse bg-gold" : "bg-emerald-400")} />
                  {busy || progress ? `${agent?.id} ${agent?.name}: ${(busy?.label || progress?.label || "").slice(0, 46)}` : `Watching ${AGENTS.length} agents${data?.event ? ` for ${data.event.name}` : ""}`}
                </div>
              </div>
              <button type="button" onClick={() => setMsgs([])} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Start a new conversation" title="New conversation"><RotateCcw className="size-4" /></button>
              <button type="button" onClick={() => setChatOpen(false)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close the assistant"><X className="size-4" /></button>
            </div>
          </header>
          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-3 py-4 scrollbar-thin">
            {!msgs.length && !thinking && (
              <div className="px-2 pt-6 text-center text-sm text-muted-foreground">Ask about anything on the desk: a company, an agent, an email, or how to do something.</div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end animate-rise"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">{m.text}</div></div>
            ) : (
              <div key={i} className="flex gap-2 animate-rise">
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl bg-gold/25 text-gold-foreground dark:text-gold"><Sparkles className="size-3.5" /></div>
                <div className="min-w-0 max-w-[88%] space-y-2">
                  <div className="rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 text-sm leading-relaxed shadow-xs"><RichText text={m.text} /></div>
                  {!!m.actions?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a: Any, j: number) => (
                        <button key={j} type="button" onClick={() => { if (a.open) openCompany(a.open); else if (a.href) router.push(a.href); if (window.innerWidth < 640) setChatOpen(false); }}
                          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">
                          {a.label} →
                        </button>
                      ))}
                    </div>
                  )}
                  {m.engine === "gemini" && <div className="pl-1 text-[0.65rem] text-muted-foreground">Phrased by Gemini (free tier) from the desk's facts</div>}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-2" aria-label="The assistant is thinking">
                <div className="grid size-7 place-items-center rounded-xl bg-gold/25 text-gold-foreground dark:text-gold"><Loader2 className="size-3.5 animate-spin" /></div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border bg-card px-4 py-3">
                  {[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d * 120}ms` }} />)}
                </div>
              </div>
            )}
          </div>
          <div className="border-t bg-card px-3 pt-2 pb-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {chips.map((c) => (
                <button key={c} type="button" disabled={thinking} onClick={() => send(c)}
                  className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-foreground/80 transition hover:border-primary hover:text-primary disabled:opacity-50">{c}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 rounded-2xl border bg-background p-1.5 pl-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <textarea ref={inputRef} id="assistant-input" rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask anything: why is Bisleri a P1?" aria-label="Your question"
                className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
              <button type="submit" disabled={!input.trim() || thinking} aria-label="Send"
                className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition disabled:opacity-40">
                <ArrowUp className="size-4" />
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
