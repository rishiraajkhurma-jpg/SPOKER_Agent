"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import {
  Bot, Building2, CalendarClock, ClipboardPen, Handshake, Inbox, KanbanSquare, LayoutDashboard, LogOut, Megaphone, Send, Settings, Sparkles, Users,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";

import { useDesk } from "./desk-provider";
import { AGENTS, type Any, api, lakh, OP_AGENT } from "./format";

export function AppSidebar() {
  const path = usePathname();
  const { data, busy, progress, me, setChatOpen } = useDesk();
  const e = data?.event;
  const msgs: Any[] = data?.messages || [];
  const drafts = msgs.filter((m) => m.status === "drafted").length + msgs.filter((m) => m.status === "needs_manual_review").length;
  const decisions = (data?.exceptions || []).filter((x: Any) => x.status === "open").length;
  const review = (data?.contacts || []).filter((c: Any) => c.is_primary && !c.reviewed_at && ["UNVERIFIED", "UNAVAILABLE", "OUTDATED"].includes(c.email_status)).length;
  const p1 = (data?.companies || []).filter((c: Any) => c.priority === "P1" && c.stage !== "DISQUALIFIED").length;
  const live = busy ? OP_AGENT[busy.op] : progress ? "A1" : "";

  const groups: { label: string; items: { title: string; url: string; icon: Any; badge?: number; tone?: string; live?: boolean }[] }[] = [
    { label: "Desk", items: [
      { title: "Dashboard", url: "/desk", icon: LayoutDashboard },
      { title: "Event brief", url: "/desk/brief", icon: ClipboardPen, badge: e && !e.floor_locked ? 1 : 0, tone: "gold" },
      { title: "Companies", url: "/desk/companies", icon: Building2, badge: p1 },
      { title: "Pipeline", url: "/desk/pipeline", icon: KanbanSquare },
      { title: "Agents", url: "/desk/agents", icon: Bot, live: !!live },
    ] },
    { label: "Needs you", items: [
      { title: "Outbox", url: "/desk/outbox", icon: Send, badge: drafts, tone: "primary" },
      { title: "Inbox", url: "/desk/inbox", icon: Inbox, badge: decisions, tone: "gold" },
      { title: "People", url: "/desk/people", icon: Users, badge: review, tone: "gold" },
    ] },
    { label: "Deals", items: [
      { title: "Meetings", url: "/desk/meetings", icon: CalendarClock },
      { title: "Deals and MOUs", url: "/desk/deals", icon: Handshake },
      { title: "Sponsor updates", url: "/desk/sponsors", icon: Megaphone },
      { title: "Settings", url: "/desk/settings", icon: Settings },
    ] },
  ];
  const isOn = (url: string) => (url === "/desk" ? path === "/desk" : path?.startsWith(url));
  const goal = Number(e?.goal_inr || 0);
  const won = (data?.deals || []).reduce((s: number, d: Any) => s + Number(d.cash_inr || 0), 0);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="gap-3 pb-1">
        <Link href="/desk" className="flex items-center gap-2.5 px-1 pt-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold font-heading text-lg font-extrabold text-gold-foreground shadow-md">S</div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-heading text-base font-bold leading-tight text-sidebar-accent-foreground">SponsorDesk</div>
            <div className="text-[0.68rem] text-sidebar-foreground/70">Sponsorship agents · Crustdata · Sarvam</div>
          </div>
        </Link>
        {e && (
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate font-heading text-sm font-semibold text-sidebar-accent-foreground">{e.name}</div>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase", e.floor_locked ? "bg-success/20 text-success" : "bg-gold/25 text-gold")}>{e.floor_locked ? "Live" : "Setup"}</span>
            </div>
            <div className="mt-0.5 truncate text-[0.7rem] text-sidebar-foreground/70">{[e.organizer, e.city].filter(Boolean).join(" · ")}</div>
            {goal > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[0.65rem] text-sidebar-foreground/70"><span>In MOUs {lakh(won)}</span><span>Goal {lakh(goal)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sidebar-border"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (won / goal) * 100)}%` }} /></div>
              </div>
            )}
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton isActive={isOn(it.url)} tooltip={it.title} render={<Link href={it.url} prefetch={false} />}
                      className="data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-accent-foreground">
                      <it.icon />
                      <span>{it.title}</span>
                      {it.live && <span className="ml-auto size-2 animate-ring rounded-full bg-gold group-data-[collapsible=icon]:hidden" aria-label="An agent is working" />}
                    </SidebarMenuButton>
                    {!!it.badge && (
                      <SidebarMenuBadge className={cn("rounded-full px-1.5 font-bold", it.tone === "gold" ? "bg-gold text-gold-foreground" : "bg-sidebar-primary text-sidebar-primary-foreground")}>{it.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-sidebar-foreground/50">Agents now</SidebarGroupLabel>
          <SidebarGroupContent>
            <Link href="/desk/agents" className="grid grid-cols-9 gap-1 px-2" aria-label="Open the agent flow">
              {AGENTS.map((a) => (
                <span key={a.id} title={`${a.id} ${a.name}: ${a.job}`}
                  className={cn("grid h-7 place-items-center rounded-md text-[0.6rem] font-bold", live === a.id ? "animate-ring bg-gold text-gold-foreground" : (data?.log || []).some((l: Any) => l.actor === a.id) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-sidebar-border/60 text-sidebar-foreground/50")}>
                  {a.id === "Email" ? "@" : a.id}
                </span>
              ))}
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ask the desk" onClick={() => setChatOpen(true)} className="bg-gold font-semibold text-gold-foreground hover:bg-gold/90 hover:text-gold-foreground">
              <Sparkles />
              <span>Ask the desk</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={() => api("/api/logout", {}).finally(() => { window.location.href = "/login"; })} className="h-auto py-1.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-[0.7rem] font-bold text-sidebar-accent-foreground">{String(me?.name || "?").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold">{me?.name || "Signed in"}</div>
                <div className="truncate text-[0.65rem] text-sidebar-foreground/60">{me?.role || ""} · sign out</div>
              </div>
              <LogOut className="size-3.5 opacity-60" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
