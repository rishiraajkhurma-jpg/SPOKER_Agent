// Sarvam voice: speech to text, text to speech and note clean-up. Off unless SARVAM_API_KEY is set.
import { wrap } from "@/lib/http";
import { hasSarvam, speak, tidyNotes, transcribe } from "@/lib/sarvam";

export const dynamic = "force-dynamic";

export const GET = wrap(async () => ({ enabled: hasSarvam() }));

export const POST = wrap(async (req) => {
  if (!hasSarvam()) throw new Error("Voice needs SARVAM_API_KEY.");
  if ((req.headers.get("content-type") || "").startsWith("multipart/")) {
    const f = await req.formData();
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("No audio received.");
    if (file.size > 5e6) throw new Error("That recording is too long.");
    return transcribe(file, f.get("mode") === "translate" ? "translate" : "transcribe");
  }
  const b = await req.json().catch(() => ({}));
  if (b.tidy) return { text: await tidyNotes(String(b.tidy)) };
  if (b.speak) return { audio: await speak(String(b.speak), String(b.lang || "en-IN")) };
  throw new Error("Nothing to do.");
});
