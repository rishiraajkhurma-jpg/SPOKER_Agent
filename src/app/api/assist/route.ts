// Desk assistant: answers questions from the desk's live state. Works without any AI key.
import { wrap } from "@/lib/http";
import { assist } from "@/lib/assistant";

export const dynamic = "force-dynamic";

export const POST = wrap(async (req) => {
  const b = await req.json().catch(() => ({}));
  return assist(String(b.message || "").slice(0, 1000), String(b.path || ""));
});
