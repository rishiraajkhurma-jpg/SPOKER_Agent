"use client";
// Loaded only in the GitHub Pages build. Runs before the app's first fetch: routes /api calls to the in-browser
// engine and fixes plain links that do not know about the /<repo>/ prefix GitHub Pages serves the site under.
import { handle } from "./engine";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (typeof window !== "undefined") {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("/api/")) return real(input, init);
    const r = await handle(url, init?.body ? JSON.parse(String(init.body)) : undefined);
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
  };
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a");
    const href = a?.getAttribute("href") || "";
    if (!a || !href.startsWith("/") || href.startsWith("//") || (BASE && href.startsWith(`${BASE}/`))) return;
    if (href.startsWith("/api/")) {
      e.preventDefault();
      window.alert("This needs the real server, so it is off in the demo.");
      return;
    }
    const [path, query] = href.split("?");
    a.setAttribute("href", `${BASE}${path.endsWith("/") ? path : `${path}/`}${query ? `?${query}` : ""}`);
  }, true);
}

export function DemoBoot() {
  return (
    <div className="noprint" style={{ position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 60, pointerEvents: "none", padding: "3px 12px", borderRadius: 999, background: "#1e1b4b", color: "#fff", font: "600 12px/1.5 system-ui, sans-serif", whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }}>
      Demo: fictional sample data, nothing is sent
    </div>
  );
}
