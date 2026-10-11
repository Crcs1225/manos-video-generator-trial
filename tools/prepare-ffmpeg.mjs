import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
const destination = path.resolve("public/ffmpeg");
await mkdir(destination, { recursive: true });
for (const name of ["worker.js", "const.js", "errors.js"]) await copyFile(path.resolve("node_modules/@ffmpeg/ffmpeg/dist/esm", name), path.join(destination, name));
await copyFile(path.resolve("node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js"), path.join(destination, "ffmpeg.js"));
console.log("FFmpeg browser worker assets prepared.");

