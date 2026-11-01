import type { ReactNode } from "react";

import "@/styles/public-docs.css";

/** Sponsor-facing pages (shared deck and MOU) keep their own print-friendly look. */
export default function PublicDocLayout({ children }: { children: ReactNode }) {
  return <div className="sd-public min-h-dvh">{children}</div>;
}
