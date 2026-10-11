export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ gemini: Boolean(process.env.GEMINI_API_KEY?.trim()), elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY?.trim()) }, { headers: { "Cache-Control": "no-store" } });
}
