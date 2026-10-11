import type { WordTiming } from "./video-types.ts";

export function srtTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(total / 3600000), minutes = Math.floor(total / 60000) % 60, secs = Math.floor(total / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(total % 1000).padStart(3, "0")}`;
}

export function makeCaptions(script: string, duration: number, speed = 1, timings?: WordTiming[]): string {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(speed) || speed <= 0) throw new Error("Invalid caption duration.");
  const tokens = script.trim().split(/\s+/).filter(Boolean);
  const words = timings?.length ? timings : tokens.map((text, index) => ({ text, start: duration * index / tokens.length, end: duration * (index + 1) / tokens.length }));
  return Array.from({ length: Math.ceil(words.length / 8) }, (_, index) => {
    const group = words.slice(index * 8, index * 8 + 8);
    const text = group.map((word) => word.text).join(" ").replace(/[<>]/g, "");
    return `${index + 1}\n${srtTimestamp(group[0].start / speed)} --> ${srtTimestamp(group.at(-1)!.end / speed)}\n${text}\n`;
  }).join("\n");
}

export function characterAlignment(value: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): WordTiming[] {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = value;
  if (!characters?.length || characters.length !== starts?.length || starts.length !== ends?.length) throw new Error("Invalid voice timing.");
  const words: WordTiming[] = [];
  let text = "", start = 0, end = 0;
  for (let index = 0; index < characters.length; index++) {
    if (typeof characters[index] !== "string" || !Number.isFinite(starts[index]) || !Number.isFinite(ends[index]) || starts[index] < 0 || ends[index] < starts[index]) throw new Error("Invalid voice timing.");
    if (/\s/.test(characters[index])) { if (text) { words.push({ text, start, end }); text = ""; } }
    else { if (!text) start = starts[index]; text += characters[index]; end = ends[index]; }
  }
  if (text) words.push({ text, start, end });
  return words;
}
