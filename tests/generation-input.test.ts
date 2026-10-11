import assert from "node:assert/strict";
import test from "node:test";
import { generationOptions, imageExtension } from "../lib/generation-input.ts";

test("validates editor controls and preserves exact narration", () => {
  const options = generationOptions({ exactScript: "These are five spoken words.", captions: false, sceneOrder: [2, 0], voice: "gemini-puck", rate: -10 });
  assert.equal(options.exactScript, "These are five spoken words.");
  assert.equal(options.captions, false);
  assert.deepEqual(options.sceneOrder, [2, 0]);
  for (const input of [{ sourceText: "x".repeat(6001) }, { rate: 100 }, { voice: "bad" }, { voice: ["gemini-kore"] }, { sceneOrder: [0, 0] }, { captions: "false" }, { exactScript: "short" }]) assert.throws(() => generationOptions(input));
});

test("image formats are selected by signature, not uploaded filename", () => {
  assert.equal(imageExtension(Uint8Array.from([255,216,255,0])), ".jpg");
  assert.equal(imageExtension(Uint8Array.from([137,80,78,71,13,10,26,10])), ".png");
  assert.throws(() => imageExtension(new TextEncoder().encode("<svg>")));
});
