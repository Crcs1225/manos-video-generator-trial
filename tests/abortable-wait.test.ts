import assert from "node:assert/strict";
import test from "node:test";
import { abortableWait } from "../lib/abortable-wait.ts";

test("cancel interrupts stalled engine loading without canceling the shared promise", async () => {
  let complete!: (value: string) => void;
  const shared = new Promise<string>((resolve) => { complete = resolve; });
  const controller = new AbortController();
  const waiting = abortableWait(shared, controller.signal);
  controller.abort();
  await assert.rejects(waiting, /canceled/);
  complete("loaded");
  assert.equal(await abortableWait(shared), "loaded");
});

test("stalled engine loading times out and already canceled signals reject", async () => {
  const stalled = new Promise<never>(() => {});
  await assert.rejects(abortableWait(stalled, undefined, 5), /timed out/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(abortableWait(stalled, controller.signal), /canceled/);
});
