export type WordTiming = { text: string; start: number; end: number };
export type Story = { title: string; script: string; sourceText: string; sourceUrl?: string; sourceType: "user" | "wikipedia" | "generated"; scriptGenerator: "source" | "gemini" | "user"; warnings: string[] };
export type Speech = { audioBase64: string; mimeType: "audio/mpeg" | "audio/wav"; words?: WordTiming[]; provider: "gemini" | "elevenlabs"; warnings: string[] };
export type LocalScene = { blob: Blob; previewUrl: string; label: string };
export type Job = { id: string; topic: string; status: "running" | "completed" | "failed"; stage: string; message: string; error?: string; resolvedTitle?: string; script?: string; sourceUrl?: string; durationSeconds?: number; sizeBytes?: number; warnings: string[]; sceneCount?: number; voice?: string; rate?: number; captions?: boolean; videoUrl?: string; story?: Story; scenes?: LocalScene[]; captionsText?: string };
