import test from "node:test";
import assert from "node:assert/strict";
import { smallJson } from "../lib/json-request.ts";
const request = (body: string, type = "application/json") => new Request("http://localhost/api/generate", { method: "POST", headers: { "Content-Type": type }, body });
test("JSON parser accepts settings and rejects malformed or oversized requests", async () => {
  assert.deepEqual(await smallJson(request('{"topic":"Coffee"}')), { topic: "Coffee" });
  await assert.rejects(() => smallJson(request("{}", "text/plain")), /Send JSON/);
  await assert.rejects(() => smallJson(request("not-json")));
  await assert.rejects(() => smallJson(request("null")), /Send an object/);
  await assert.rejects(() => smallJson(request("[]")), /Send an object/);
  await assert.rejects(() => smallJson(request(JSON.stringify({ sourceText: "x".repeat(32000) }))), /32 KB/);
});
