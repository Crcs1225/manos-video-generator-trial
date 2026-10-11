import { generationOptions } from "@/lib/generation-input";
import { smallJson } from "@/lib/json-request";
import { createSpeech } from "@/lib/server-speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  let options;
  try {
    const input = await smallJson(request);
    options = generationOptions({ ...input, exactScript: input.script });
    if (!options.exactScript || options.voice === "upload") throw new Error("Choose an API voice and provide 5 to 180 narration words.");
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try { return Response.json(await createSpeech(options.exactScript, options.voice), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 502 }); }
}
