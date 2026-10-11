import { generationOptions } from "@/lib/generation-input";
import { smallJson } from "@/lib/json-request";
import { ContentGenerationError, prepareStory } from "@/lib/server-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let input, options;
  try {
    input = await smallJson(request);
    if (typeof input.topic !== "string" || !input.topic.trim() || input.topic.trim().length > 200) throw new Error("Enter a topic between 1 and 200 characters.");
    options = generationOptions(input);
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    return Response.json(await prepareStory((input.topic as string).trim(), options.sourceText, options.exactScript, options.rewrite), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof ContentGenerationError ? error.message : "Content generation unavailable. Check your source text or try again later." }, { status: 502 }); }
}
