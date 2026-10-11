import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3102";
const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const home = await fetch(base);
assert.equal(home.status, 200);
assert.match(await home.text(), /Make a short/);
for (const body of [{ topic: "" }, { topic: "x".repeat(201) }, {}, null]) assert.equal((await post("/api/generate", body)).status, 400);
assert.equal((await fetch(`${base}/api/generate`, { method: "POST", body: "not-json" })).status, 400);
assert.equal((await post("/api/generate", { topic: "Test", sourceText: "x".repeat(33000) })).status, 400);
const config = await (await fetch(`${base}/api/config`)).json();
assert.deepEqual(Object.keys(config).sort(), ["elevenlabs", "gemini"]);
assert.equal(typeof config.gemini, "boolean"); assert.equal(typeof config.elevenlabs, "boolean");
const script = "These are the exact narration words supplied by the user.";
const response = await post("/api/generate", { topic: "My title", exactScript: script });
assert.equal(response.status, 200);
const story = await response.json();
assert.equal(story.script, script); assert.equal(story.scriptGenerator, "user");
for (const body of [{ script: "too short" }, { script, voice: "upload" }, { script, voice: "unknown" }]) assert.equal((await post("/api/voice", body)).status, 400);
assert.equal((await post("/api/visuals", { topic: "", script })).status, 400);
assert.equal((await post("/api/visuals", { topic: "Coffee", script: "short" })).status, 400);
for (const asset of ["ffmpeg.js", "worker.js", "const.js", "errors.js"]) {
  const response = await fetch(`${base}/ffmpeg/${asset}`); assert.equal(response.status, 200); assert.match(response.headers.get("content-type") || "", /javascript/);
}
assert.equal((await fetch(`${base}/api/jobs/not-a-job`)).status, 404);
console.log("Stateless API validation, exact narration, provider flags, and browser worker assets passed.");
