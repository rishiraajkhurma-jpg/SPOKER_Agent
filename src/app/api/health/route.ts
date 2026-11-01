// Connection check: one tiny call per service, so problems show up before an agent run.
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { credits, hasCrustdata } from "@/lib/crustdata";
import { connectedEmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function check(fn: () => Promise<string>) {
  const t = Date.now();
  try { return { ok: true, detail: await fn(), ms: Date.now() - t }; }
  catch (e: any) { return { ok: false, detail: String(e?.message || e).replace(/\s+/g, " ").slice(0, 300), ms: Date.now() - t }; }
}

export async function GET(req: Request) {
  const g = await guard(req); if (g) return g;
  const out: Record<string, any> = {};
  out.database = await check(async () => { const d = await db(); await d.q("SELECT 1"); return "connected"; });
  out.engine = { ok: true, detail: "Rules and templates decide; Sarvam adds voice and Indian languages when its key is set" };
  // Free call: the credit balance proves the key works without spending anything.
  out.crustdata = !hasCrustdata() ? { ok: false, detail: "CRUSTDATA_API_KEY not set: company discovery and contact search are off" } : await check(async () => {
    const c = await credits();
    return `connected${c != null ? `, ${Math.round(c).toLocaleString("en-IN")} credits left` : ""}`;
  });
  out.gmail = { ok: !!(await connectedEmail()), detail: (await connectedEmail()) || "not connected (draft mode)" };
  return Response.json(out);
}
