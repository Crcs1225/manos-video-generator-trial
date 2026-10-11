"use client";

import type { LocalScene, Speech, Story } from "./video-types";
import { makeCaptions } from "./captions";
import type { FFmpeg as BrowserFFmpeg } from "@ffmpeg/ffmpeg";
import type { Illustration } from "./illustration";
import { localIllustrations } from "./illustration";
import { paintIllustration } from "./illustration-painter";
import { abortableWait } from "./abortable-wait";

let enginePromise: Promise<{ FFmpeg: new () => BrowserFFmpeg }> | undefined;
function loadEngine() {
  if (!enginePromise) enginePromise = new Promise<{ FFmpeg: new () => BrowserFFmpeg }>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/ffmpeg/ffmpeg.js";
    script.onload = () => {
      const engine = (window as unknown as { FFmpegWASM?: { FFmpeg: new () => BrowserFFmpeg } }).FFmpegWASM;
      if (engine) resolve(engine);
      else { enginePromise = undefined; reject(new Error("Browser video engine could not load.")); }
    };
    script.onerror = () => { enginePromise = undefined; script.remove(); reject(new Error("Browser video engine could not load.")); };
    document.head.appendChild(script);
  });
  return enginePromise;
}

async function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare image.")), "image/png"));
}
function lines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = `${current} ${word}`.trim();
    if (current && context.measureText(candidate).width > width) { result.push(current); current = word; } else current = candidate;
  }
  if (current) result.push(current);
  return result;
}
export async function card(title: string, body: string, label = "MANOS / YOUR STORY"): Promise<LocalScene> {
  const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#101c25"; context.fillRect(0, 0, 1280, 720);
  context.fillStyle = "#d8f278"; context.fillRect(70, 75, 46, 6); context.font = "20px Arial"; context.fillText(label, 140, 80);
  context.fillStyle = "white"; context.font = "54px Arial";
  let y = 155;
  for (const line of lines(context, title, 1120).slice(0, 2)) { context.fillText(line, 70, y); y += 68; }
  y += 34; context.fillStyle = "#c4cbd0";
  let wrapped: string[] = [], height = 38;
  for (const size of [28, 24, 20, 16, 12]) { context.font = `${size}px Arial`; wrapped = lines(context, body, 1100); height = size * 1.35; if (wrapped.length * height < 660 - y) break; }
  for (const line of wrapped) { context.fillText(line, 74, y); y += height; }
  const blob = await png(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob), label: title };
}

async function drawIllustration(scene: Illustration): Promise<LocalScene> {
  const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext("2d")!;
  paintIllustration(context, scene);
  const blob = await png(canvas); return { blob, previewUrl: URL.createObjectURL(blob), label: scene.title };
}

export async function prepareScenes(files: File[], story: Story, illustrations?: Illustration[]): Promise<LocalScene[]> {
  if (!files.length) {
    return Promise.all((illustrations || localIllustrations(story.title, story.script)).map(drawIllustration));
  }
  const result: LocalScene[] = [];
  try {
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error("Choose JPEG/PNG images of at most 5 MB each.");
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 25_000_000) throw new Error("Image exceeds 25 megapixels.");
        const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
        const context = canvas.getContext("2d")!; context.fillStyle = "#101c25"; context.fillRect(0, 0, 1280, 720);
        const scale = Math.min(1280 / bitmap.width, 720 / bitmap.height), width = bitmap.width * scale, height = bitmap.height * scale;
        context.drawImage(bitmap, (1280 - width) / 2, (720 - height) / 2, width, height);
        const blob = await png(canvas);
        result.push({ blob, previewUrl: URL.createObjectURL(blob), label: file.name });
      } finally { bitmap.close(); }
    }
    return result;
  } catch (error) { result.forEach((scene) => URL.revokeObjectURL(scene.previewUrl)); throw error; }
}

export async function renderVideo(story: Story, scenes: LocalScene[], speech: Speech | Blob, rate: number, captions: boolean, progress: (message: string, percent?: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; duration: number; captionText: string }> {
  if (signal?.aborted) throw new Error("Rendering canceled.");
  if (!scenes.length || scenes.length > 6) throw new Error("Choose between one and six scenes.");
  const { FFmpeg } = await abortableWait(loadEngine(), signal);
  if (signal?.aborted) throw new Error("Rendering canceled.");
  const ffmpeg = new FFmpeg();
  let phaseStart = 60, phaseSpan = 0, currentMessage = "Loading video engine";
  ffmpeg.on("progress", ({ progress: fraction }) => { if (Number.isFinite(fraction)) progress(currentMessage, Math.min(99, phaseStart + Math.max(0, Math.min(1, fraction)) * phaseSpan)); });
  const downloadController = new AbortController();
  const urls: string[] = [];
  const abort = () => { downloadController.abort(); ffmpeg.terminate(); };
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 8 * 60 * 1000);
  let credit: LocalScene | undefined;
  try {
    progress("Loading the browser video engine (about 31 MB on first use)", 55);
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
    const blobUrl = async (url: string, type: string) => {
      const response = await fetch(url, { signal: downloadController.signal });
      if (!response.ok) throw new Error("Video engine download failed. Check your internet connection.");
      const result = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type })); urls.push(result); return result;
    };
    const coreURL = await blobUrl(`${base}/ffmpeg-core.js`, "text/javascript"), wasmURL = await blobUrl(`${base}/ffmpeg-core.wasm`, "application/wasm");
    if (signal?.aborted) throw new Error("Rendering canceled.");
    await ffmpeg.load({ classWorkerURL: new URL("/ffmpeg/worker.js", window.location.href).href, coreURL, wasmURL });
    const audio = speech instanceof Blob ? speech : new Blob([Uint8Array.from(atob(speech.audioBase64), (character) => character.charCodeAt(0))], { type: speech.mimeType });
    const audioBytes = await audio.arrayBuffer();
    const context = new AudioContext();
    let duration: number;
    try { duration = (await context.decodeAudioData(audioBytes.slice(0))).duration; } finally { await context.close(); }
    if (!Number.isFinite(duration) || duration < 1 || duration > 90) throw new Error("Use narration between 1 and 90 seconds.");
    const speed = 1 + rate / 100;
    const captionText = makeCaptions(story.script, duration, speed, speech instanceof Blob ? undefined : speech.words);
    await ffmpeg.writeFile("narration.audio", new Uint8Array(audioBytes));
    await ffmpeg.writeFile("captions.srt", captionText);
    if (captions) {
      const font = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth,wght%5D.ttf", { signal: downloadController.signal });
      if (!font.ok) throw new Error("Caption font could not download. Try again or turn captions off.");
      await ffmpeg.writeFile("Roboto.ttf", new Uint8Array(await font.arrayBuffer()));
    }
    const credits = story.sourceType === "wikipedia" ? `Text: Wikipedia contributors, CC BY-SA 4.0. ${story.sourceUrl || "https://en.wikipedia.org"}` : story.sourceType === "generated" ? "Narration generated from the topic with Gemini. Review facts before sharing. Visuals are user-provided images or generated topic illustrations." : "Text provided by the user. Visuals are user-provided images or generated topic illustrations. Review rights before sharing.";
    credit = await card("Sources & credits", credits + (!(speech instanceof Blob) && speech.provider === "elevenlabs" ? " Voice generated with ElevenLabs. elevenlabs.io. Free-plan audio: noncommercial use." : ""), "MANOS / SOURCE NOTES");
    const allScenes = [...scenes, credit];
    const durations = [...scenes.map(() => duration / speed / scenes.length), 4];
    const execute = async (args: string[]) => {
      if (signal?.aborted) throw new Error("Rendering canceled.");
      if (await ffmpeg.exec(args, 240000) !== 0) throw new Error("Browser rendering failed or timed out. Try fewer scenes or a shorter narration.");
    };
    for (let index = 0; index < allScenes.length; index++) {
      phaseStart = 60 + index * 25 / allScenes.length; phaseSpan = 25 / allScenes.length;
      currentMessage = `Rendering scene ${index + 1} of ${allScenes.length}`;
      progress(currentMessage, phaseStart);
      await ffmpeg.writeFile(`image-${index}.png`, new Uint8Array(await allScenes[index].blob.arrayBuffer()));
      await execute(["-loop", "1", "-framerate", "24", "-i", `image-${index}.png`, "-t", durations[index].toFixed(4), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "25", "-pix_fmt", "yuv420p", "-an", `scene-${index}.mp4`]);
    }
    await ffmpeg.writeFile("scenes.txt", allScenes.map((_, index) => `file 'scene-${index}.mp4'`).join("\n"));
    phaseStart = 85; phaseSpan = 14; currentMessage = "Combining narration, captions, and scenes";
    progress(currentMessage, phaseStart);
    await execute(["-f", "concat", "-safe", "0", "-i", "scenes.txt", "-i", "narration.audio", "-map", "0:v:0", "-map", "1:a:0", ...(captions ? ["-vf", "subtitles=filename=captions.srt:fontsdir=.:force_style='FontName=Roboto,FontSize=15,Outline=1,BorderStyle=3,BackColour=&H80000000,Alignment=2,MarginV=12,MarginL=20,MarginR=20'"] : []), "-af", `atempo=${speed},apad`, "-shortest", "-c:v", captions ? "libx264" : "copy", ...(captions ? ["-preset", "ultrafast", "-crf", "25"] : []), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "output.mp4"]);
    const bytes = await ffmpeg.readFile("output.mp4");
    if (typeof bytes === "string" || bytes.length < 1000) throw new Error("No usable MP4 was created.");
    return { blob: new Blob([new Uint8Array(bytes)], { type: "video/mp4" }), duration: duration / speed + 4, captionText };
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", abort); ffmpeg.terminate(); urls.forEach((url) => URL.revokeObjectURL(url)); if (credit) URL.revokeObjectURL(credit.previewUrl);
  }
}
