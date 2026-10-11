import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "handoff");
await mkdir(destination, { recursive: true });
const files = ["package.json", "package-lock.json", "README.md", "PART2_REQUIREMENTS.md", "SUBMISSION_NOTES.md", "BUILD_LOG.md", ".env.example", ".gitignore", "AGENTS.md", "next.config.ts", "eslint.config.mjs", "tsconfig.json"];
async function collect(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(relative);
    else if (entry.isFile() && !entry.name.startsWith(".env") && !/\.(py|pyc)$/.test(entry.name)) files.push(relative);
  }
}
for (const directory of ["app", "lib", "tests", "tools", "public"]) await collect(directory);
const entries = {};
for (const file of files.sort()) entries[`${path.basename(root)}/${file}`] = new Uint8Array(await readFile(path.join(root, file)));
const archive = path.join(destination, "manos-video-generator-trial-source.zip");
await writeFile(archive, zipSync(entries));
const packaged = [archive];
const sample = path.join(root, "output/sample");
let status = {};
try { status = JSON.parse(await readFile(path.join(sample, "status.json"), "utf8")); } catch { /* Sample is optional. */ }
let videoReady = false;
if (status.status === "completed") {
  try {
    const bytes = await readFile(path.join(sample, "output.mp4"));
    if (bytes.length > 1000 && bytes.subarray(4, 8).toString() === "ftyp") {
      await writeFile(path.join(destination, "generated-video.mp4"), bytes);
      packaged.push(path.join(destination, "generated-video.mp4")); videoReady = true;
    }
  } catch { /* Preserve prior handoff artifacts; report missing sample. */ }
}
if (videoReady) for (const name of ["credits.json", "captions.srt", "script.txt"]) {
  try { const target = path.join(destination, name); await copyFile(path.join(sample, name), target); packaged.push(target); } catch { /* Optional companion. */ }
}
const notes = path.join(destination, "SUBMISSION_NOTES.md");
await copyFile(path.join(root, "SUBMISSION_NOTES.md"), notes); packaged.push(notes);
const manifest = {
  packagedAtUtc: new Date().toISOString(),
  sampleStatus: videoReady ? "completed" : "not-generated",
  sampleProvenance: "Preserved MP4 from the earlier local pipeline. User verified an earlier browser-generated video; latest model and visual fixes still require a new browser render.",
  missingDeliverables: videoReady ? [] : ["Generated MP4: generate in the browser and download it."],
  files: await Promise.all(packaged.map(async (file) => { const bytes = await readFile(file); return { name: path.basename(file), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; })),
};
await writeFile(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
