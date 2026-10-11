import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const deadlineUtc = "2026-10-11T17:36:45Z";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "output"), { recursive: true });
async function tick() {
  const remainingSeconds = Math.max(0, Math.floor((Date.parse(deadlineUtc) - Date.now()) / 1000));
  await writeFile(path.join(root, "output/build-timer.json"), JSON.stringify({ deadlineUtc, remainingSeconds, expired: remainingSeconds === 0 }));
  if (!remainingSeconds) { console.log("Two-hour build limit reached. Stop work and preserve current artifacts."); return; }
  setTimeout(() => void tick(), 5000);
}
await tick();
