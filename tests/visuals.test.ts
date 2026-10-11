import test from "node:test";
import assert from "node:assert/strict";
import { createVisualPlan } from "../lib/server-visuals.ts";
import { localIllustrations } from "../lib/illustration.ts";
import { paintIllustration } from "../lib/illustration-painter.ts";
async function withProvider(mock: typeof fetch, action: () => Promise<void>) {
  const original = globalThis.fetch, previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fake-test-key"; globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = original; if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
}
test("illustration generation uses the current model and three separate narration segments", async () => {
  const scenes = localIllustrations("TypeScript", "These words describe programming and type safety in a browser.");
  await withProvider(async (url, options) => {
    assert.match(String(url), /models\/gemini-3\.5-flash-lite:generateContent/);
    const body = JSON.parse(options!.body as string);
    const input = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(input.scenes.length, 3);
    assert.equal(input.scenes.map((scene: { narration: string }) => scene.narration).join(" "), "These words describe programming and type safety in a browser.");
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ scenes }) }] } }] });
  }, async () => {
    const plan = await createVisualPlan("TypeScript", "These words describe programming and type safety in a browser.");
    assert.deepEqual(plan.scenes, scenes); assert.match(plan.warnings[0], /designed with Gemini/);
  });
});
test("provider rejection gives distinct local drawings and a sanitized status", async () => {
  await withProvider(async () => new Response("private response body", { status: 404 }), async () => {
    const plan = await createVisualPlan("TypeScript", "TypeScript checks types before code runs in a browser.");
    assert.match(plan.warnings[0], /HTTP 404/); assert.doesNotMatch(plan.warnings[0], /private/);
    assert.equal(new Set(plan.scenes.map((scene) => JSON.stringify(scene.shapes))).size, 3);
    assert.ok(plan.scenes[0].shapes.some((shape) => shape.text?.includes("string")));
  });
});
test("recolored and relabeled duplicate provider drawings are rejected in favor of distinct scenes", async () => {
  const scene = localIllustrations("Coffee", "These words describe brewing a cup of coffee.")[0];
  const scenes = ["#101c25", "#14323c", "#243047"].map((background, index) => ({ ...scene, title: `Scene ${index}`, background, shapes: scene.shapes.map((shape) => ({ ...shape, color: ["#ffffff", "#ff0000", "#00ff00"][index], ...(shape.kind === "text" ? { text: `Label ${index}` } : {}) })).reverse() }));
  await withProvider(async () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ scenes }) }] } }] }), async () => {
    const plan = await createVisualPlan("Coffee", "These words describe brewing a cup of coffee.");
    assert.match(plan.warnings[0], /invalid/);
    assert.equal(new Set(plan.scenes.map((scene) => JSON.stringify(scene.shapes))).size, 3);
  });
});
test("illustration painter clips artwork and places title above the caption band", () => {
  const drawnText: { text: string; y: number; clipped: boolean }[] = [];
  const rectangles: number[][] = [];
  let clipped = false;
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    save() {}, restore() { clipped = false; }, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, ellipse() {}, fill() {}, stroke() {},
    rect(...coordinates: number[]) { rectangles.push(coordinates); }, clip() { clipped = true; },
    fillRect(...coordinates: number[]) { rectangles.push(coordinates); },
    fillText(text: string, _x: number, y: number) { drawnText.push({ text, y, clipped }); },
    measureText(text: string) { return { width: text.length * 20 }; },
  } as unknown as CanvasRenderingContext2D;
  const scene = localIllustrations("TypeScript", "These words are narration about programming.")[0];
  paintIllustration(context, scene);
  assert.ok(rectangles.some((rectangle) => JSON.stringify(rectangle) === "[40,150,1200,370]"));
  assert.ok(rectangles.some((rectangle) => JSON.stringify(rectangle) === "[0,540,1280,180]"));
  const title = drawnText.find((entry) => entry.text === scene.title)!;
  assert.ok(title.y < 150 && !title.clipped);
  assert.ok(drawnText.filter((entry) => !entry.clipped).every((entry) => entry.y < 150));
});
