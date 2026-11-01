"use client";

import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { AppSidebar } from "./app-sidebar";
import { Assistant } from "./assistant";
import { CompanySheet } from "./company-sheet";
import { DeskHeader } from "./desk-header";
import { DeskProvider, useDesk } from "./desk-provider";

function Main({ children }: { children: ReactNode }) {
  const { data } = useDesk();
  if (!data) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label="Opening the desk">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 pb-28 md:p-6 md:pb-28">{children}</div>;
}

export function DeskShell({ children, defaultOpen }: { children: ReactNode; defaultOpen: boolean }) {
  return (
    <DeskProvider>
      <SidebarProvider defaultOpen={defaultOpen} style={{ "--sidebar-width": "16.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip">
          <DeskHeader />
          <Main>{children}</Main>
        </SidebarInset>
        <CompanySheet />
        <Assistant />
      </SidebarProvider>
    </DeskProvider>
  );
}
