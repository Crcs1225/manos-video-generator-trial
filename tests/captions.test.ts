import test from "node:test";
import assert from "node:assert/strict";
import { characterAlignment, makeCaptions, srtTimestamp } from "../lib/captions.ts";
import { pcmToWav, createSpeech } from "../lib/server-speech.ts";
import { prepareStory } from "../lib/server-content.ts";

test("caption timestamps and speaking speed preserve actual speech alignment", () => {
  assert.equal(srtTimestamp(61.234), "00:01:01,234");
  const srt = makeCaptions("Hello world", 4, 2, [{ text: "Hello", start: 0, end: 1 }, { text: "world", start: 2, end: 4 }]);
  assert.match(srt, /00:00:00,000 --> 00:00:02,000/);
  assert.match(makeCaptions("one two three four five six seven eight nine", 9), /2\n00:00:08,000 --> 00:00:09,000/);
  assert.throws(() => makeCaptions("words", 0));
});
test("character timing is converted to complete words", () => {
  const words = characterAlignment({ characters: [..."Hi you"], character_start_times_seconds: [0,.1,.2,.3,.4,.5], character_end_times_seconds: [.1,.2,.3,.4,.5,.6] });
  assert.deepEqual(words.map((word) => word.text), ["Hi", "you"]);
  assert.equal(words[1].start, .3);
  assert.throws(() => characterAlignment({ characters: ["a"], character_start_times_seconds: [], character_end_times_seconds: [] }));
});
test("PCM conversion writes a valid mono WAV header", () => {
  const bytes = pcmToWav(new Uint8Array(48000));
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.readUInt32LE(24), 24000);
  assert.equal(bytes.readUInt32LE(40), 48000);
  assert.throws(() => pcmToWav(new Uint8Array(3)));
});
test("exact user narration needs no external request", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Must not call provider"); };
  try { const story = await prepareStory("My video", "", "These are my exact narration words.", true); assert.equal(story.scriptGenerator, "user"); assert.equal(story.script, "These are my exact narration words."); }
  finally { globalThis.fetch = original; }
});
test("ElevenLabs paid plan or unverifiable quota never receives a speech request", async () => {
  const original = globalThis.fetch, previousKey = process.env.ELEVENLABS_API_KEY, previousGemini = process.env.GEMINI_API_KEY;
  process.env.ELEVENLABS_API_KEY = "test"; delete process.env.GEMINI_API_KEY;
  const calls: string[] = [];
  try {
    for (const subscription of [{ tier: "starter" }, { tier: "free" }, { tier: "free", character_limit: 10000, character_count: 10000 }]) {
      calls.length = 0;
      globalThis.fetch = async (url) => { calls.push(String(url)); return Response.json(subscription); };
      await assert.rejects(() => createSpeech("These words are narration.", "eleven-sarah"), /GEMINI_API_KEY/);
      assert.equal(calls.length, 1); assert.match(calls[0], /subscription/);
    }
  }
  finally { globalThis.fetch = original; if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = previousKey; if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini; }
});
