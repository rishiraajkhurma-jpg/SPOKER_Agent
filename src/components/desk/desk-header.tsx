"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Building2, Loader2, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { useDesk } from "./desk-provider";
import { type Any, AGENTS, brandName, OP_AGENT } from "./format";
import { LayoutControls } from "./layout-controls";
import { ThemeSwitcher } from "./theme-switcher";

const PAGES = [
  ["Dashboard", "/desk"], ["Event brief", "/desk/brief"], ["Companies", "/desk/companies"], ["Pipeline", "/desk/pipeline"], ["Agents", "/desk/agents"],
  ["Outbox", "/desk/outbox"], ["Inbox", "/desk/inbox"], ["People", "/desk/people"], ["Meetings", "/desk/meetings"], ["Deals and MOUs", "/desk/deals"],
  ["Sponsor updates", "/desk/sponsors"], ["Settings", "/desk/settings"],
];
const TITLES: Record<string, string> = Object.fromEntries(PAGES.map(([t, u]) => [u, t]));

export function DeskHeader() {
  const path = usePathname() || "/desk";
  const router = useRouter();
  const { data, busy, progress, openCompany, ask, setChatOpen } = useDesk();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const agent = busy ? AGENTS.find((a) => a.id === OP_AGENT[busy.op]) : progress ? AGENTS[1] : null;
  const label = busy?.label || progress?.label || "";
  const title = TITLES[path] || "SponsorDesk";
  const go = (u: string) => { setOpen(false); router.push(u); };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/75 backdrop-blur-md">
      <div className="flex w-full items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
        <div className="hidden font-heading text-sm font-semibold sm:block">{title}</div>
        <button type="button" onClick={() => setOpen(true)}
          className="ml-2 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-2.5 text-sm text-muted-foreground transition hover:bg-muted sm:max-w-xs">
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">Search companies, pages, actions</span>
          <kbd className="ml-auto hidden rounded border bg-background px-1.5 font-mono text-[0.65rem] sm:inline">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {(busy || progress) && (
            <div className="hidden items-center gap-2 rounded-full border border-gold/40 bg-gold/15 py-1 pr-3 pl-1.5 text-xs md:flex" role="status" aria-live="polite">
              <span className="grid size-5 place-items-center rounded-full bg-gold text-[0.6rem] font-bold text-gold-foreground">{agent?.id === "Email" ? "@" : agent?.id || <Loader2 className="size-3 animate-spin" />}</span>
              <span className="max-w-64 truncate font-medium">{label}</span>
              {progress && <span className="font-semibold num text-muted-foreground">{progress.done + 1}/{progress.total}</span>}
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setChatOpen(true)}>
            <Sparkles className="size-3.5 text-gold" /><span className="hidden sm:inline">Ask the desk</span>
          </Button>
          <LayoutControls />
          <ThemeSwitcher />
        </div>
      </div>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a company, a page or a question..." />
        <CommandList>
          <CommandEmpty>Nothing found. Press Enter in the chat to ask the desk instead.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => { setOpen(false); ask("What's going on?"); }}><Sparkles />Ask: what's going on?</CommandItem>
            <CommandItem onSelect={() => { setOpen(false); ask("What should I do next?"); }}><Sparkles />Ask: what should I do next?</CommandItem>
            <CommandItem onSelect={() => go("/desk/brief")}>Edit the event brief</CommandItem>
            <CommandItem onSelect={() => go("/desk/outbox")}>Review drafts in the Outbox</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Companies">
            {(data?.companies || []).slice(0, 60).map((c: Any) => (
              <CommandItem key={c.id} value={`${c.name} ${c.domain}`} onSelect={() => { setOpen(false); openCompany(c.id); }}>
                <Building2 />{brandName(c)}<span className="ml-auto text-xs text-muted-foreground">{c.priority || ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {PAGES.map(([t, u]) => <CommandItem key={u} onSelect={() => go(u)}>{t}</CommandItem>)}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
