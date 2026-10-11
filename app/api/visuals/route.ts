import { smallJson } from "@/lib/json-request";
import { generationOptions } from "@/lib/generation-input";
import { createVisualPlan } from "@/lib/server-visuals";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;
export async function POST(request: Request) {
  let topic: string, script: string;
  try {
    const input = await smallJson(request);
    if (typeof input.topic !== "string" || !input.topic.trim() || input.topic.length > 200) throw new Error("Provide a topic of at most 200 characters.");
    topic = input.topic.trim(); script = generationOptions({ exactScript: input.script }).exactScript;
    if (!script) throw new Error("Provide narration for the illustrations.");
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  return Response.json(await createVisualPlan(topic, script), { headers: { "Cache-Control": "no-store" } });
}
