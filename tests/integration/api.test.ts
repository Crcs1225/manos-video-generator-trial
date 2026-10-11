import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { validateIllustrations } from "../../lib/illustration.ts";

let server: ChildProcess | undefined;
let base = "";
let output = "";
before(async () => {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: { ...process.env, GEMINI_API_KEY: "", ELEVENLABS_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout?.on("data", (data) => { output = (output + data.toString()).slice(-4000); });
  server.stderr?.on("data", (data) => { output = (output + data.toString()).slice(-4000); });
  const startup = Date.now();
  while (Date.now() - startup < 15000) {
    if (server.exitCode !== null) throw new Error(`Integration server exited: ${output}`);
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Wait for startup. */ }
    await delay(100);
  }
  throw new Error(`Integration server did not become ready: ${output}`);
});
after(async () => {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise<void>((resolve) => server!.once("exit", () => resolve()));
  server.kill();
  await Promise.race([stopped, delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
});
const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });

test("home and FFmpeg assets are served by the real Next.js server", async () => {
  assert.match(await (await fetch(base)).text(), /Make a short/);
  for (const name of ["ffmpeg.js", "worker.js", "const.js", "errors.js"]) {
    const response = await fetch(`${base}/ffmpeg/${name}`);
    assert.equal(response.status, 200); assert.match(response.headers.get("content-type") || "", /javascript/);
  }
  assert.equal((await fetch(`${base}/api/jobs/old-job`)).status, 404);
});
test("server configuration exposes booleans without keys", async () => {
  const response = await fetch(`${base}/api/config`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { gemini: false, elevenlabs: false });
});
test("generation validates input and preserves exact optional-source narration", async () => {
  for (const body of [{ topic: "" }, { topic: "x".repeat(201) }, {}, null, { topic: "Topic", sourceText: "x".repeat(33000) }]) assert.equal((await post("/api/generate", body)).status, 400);
  const script = "These are my exact narration words for this demonstration video.";
  const response = await post("/api/generate", { topic: "My video", exactScript: script });
  assert.equal(response.status, 200); const story = await response.json();
  assert.equal(story.script, script); assert.equal(story.sourceType, "user"); assert.equal(story.scriptGenerator, "user");
});
test("optional images produce valid automatic illustration plans without API keys", async () => {
  const response = await post("/api/visuals", { topic: "Solar System", script: "The Solar System contains planets orbiting our star, the Sun." });
  assert.equal(response.status, 200); const data = await response.json();
  const scenes = validateIllustrations(data);
  assert.equal(scenes.length, 3); assert.match(data.warnings[0], /local topic illustrations/);
  assert.equal(new Set(scenes.map((scene) => JSON.stringify(scene.shapes))).size, 3);
  for (const body of [{ topic: "", script: "These are valid narration words." }, { topic: "Topic", script: "short" }]) assert.equal((await post("/api/visuals", body)).status, 400);
});
test("voice route rejects invalid controls and explains missing provider configuration", async () => {
  const script = "These are narration words for the integration test.";
  for (const body of [{ script: "short" }, { script, voice: "upload" }, { script, voice: "unknown" }]) assert.equal((await post("/api/voice", body)).status, 400);
  const response = await post("/api/voice", { script, voice: "gemini-kore" });
  assert.equal(response.status, 502); assert.match((await response.json()).error, /GEMINI_API_KEY/);
});
