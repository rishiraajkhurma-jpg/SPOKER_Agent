import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { DeskShell } from "@/components/desk/desk-shell";

export default async function DeskLayout({ children }: Readonly<{ children: ReactNode }>) {
  const store = await cookies();
  const defaultOpen = store.get("sidebar_state")?.value !== "false";
  return <DeskShell defaultOpen={defaultOpen}>{children}</DeskShell>;
}
