import test from "node:test";
import assert from "node:assert/strict";
import { prepareStory, ContentGenerationError } from "../lib/server-content.ts";
import { illustrationGeometryKey, localIllustrations, validateIllustrations } from "../lib/illustration.ts";
const script = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ") + ".";
async function withProvider(mock: typeof fetch, action: () => Promise<void>) {
  const original = globalThis.fetch, previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fake-test-key"; globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = original; if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
}
test("blank source text generates directly from topic without Wikipedia dependency", async () => {
  const calls: string[] = [];
  await withProvider(async (url, options) => {
    calls.push(String(url)); assert.match(String(url), /models\/gemini-3\.5-flash-lite:generateContent/);
    assert.deepEqual(JSON.parse(JSON.parse(options!.body as string).contents[0].parts[0].text), { topic: "Solar System" });
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: script }] } }] });
  }, async () => {
    const story = await prepareStory("Solar System", "", "", true);
    assert.equal(story.script, script); assert.equal(story.sourceType, "generated");
    assert.equal(story.sourceUrl, undefined); assert.equal(story.scriptGenerator, "gemini"); assert.equal(calls.length, 1);
  });
});
test("topic generation uses Wikipedia fallback after Gemini quota rejection", async () => {
  const calls: string[] = [];
  await withProvider(async (url) => {
    calls.push(String(url));
    if (String(url).includes("generativelanguage")) return new Response("quota", { status: 429 });
    if (String(url).includes("list=search")) return Response.json({ query: { search: [{ pageid: 123 }] } });
    return Response.json({ query: { pages: [{ pageid: 123, title: "Solar System", extract: script, fullurl: "https://en.wikipedia.org/wiki/Solar_System" }] } });
  }, async () => {
    const story = await prepareStory("Solar System", "", "", true);
    assert.equal(story.sourceType, "wikipedia"); assert.match(story.warnings[0], /HTTP 429/); assert.equal(calls.length, 3);
  });
});
test("unavailable topic services report the real sanitized failure", async () => {
  await withProvider(async (url) => {
    if (String(url).includes("generativelanguage")) return new Response("private response details", { status: 403 });
    throw new Error("private transport details");
  }, async () => {
    await assert.rejects(() => prepareStory("Topic", "", "", true), (error) => error instanceof ContentGenerationError && /HTTP 403/.test(error.message) && /Wikipedia fallback/.test(error.message) && !/private/.test(error.message));
  });
});
test("local illustrated fallback creates valid PNG drawing plans for topics", () => {
  for (const topic of ["Solar System", "Coffee", "Mount Fuji", "Forest", "TypeScript", "Computers", "History", "x".repeat(200)]) {
    const scenes = validateIllustrations({ scenes: localIllustrations(topic, "A short narration about this topic.") });
    assert.equal(scenes.length, 3); assert.ok(scenes.every((scene) => scene.shapes.length >= 3));
    assert.equal(new Set(scenes.map(illustrationGeometryKey)).size, 3, `${topic}: must have different artwork, not only background colors`);
    assert.equal(new Set(scenes.map((scene) => scene.title)).size, 3);
  }
  assert.throws(() => validateIllustrations({ scenes: [{ title: "Bad", background: "url(external)", shapes: [] }] }));
  const scenes = localIllustrations("Coffee", "coffee narration"); scenes[0].shapes[0].x = -1;
  assert.throws(() => validateIllustrations({ scenes }));
  const invalidText = localIllustrations("TypeScript", "A valid narration script about programming.");
  invalidText[0].shapes.find((shape) => shape.kind === "text")!.text = "x".repeat(81);
  assert.throws(() => validateIllustrations({ scenes: invalidText }), /label/);
});
