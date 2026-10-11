import { characterAlignment } from "./captions.ts";
import type { Speech } from "./video-types";

export function pcmToWav(pcm: Uint8Array, rate = 24000): Buffer {
  if (!pcm.length || pcm.length % 2) throw new Error("Invalid speech audio.");
  const result = Buffer.alloc(44 + pcm.length);
  result.write("RIFF", 0); result.writeUInt32LE(36 + pcm.length, 4); result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(rate, 24); result.writeUInt32LE(rate * 2, 28); result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34);
  result.write("data", 36); result.writeUInt32LE(pcm.length, 40); Buffer.from(pcm).copy(result, 44);
  return result;
}

async function geminiSpeech(script: string, voice: string): Promise<Speech> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Set GEMINI_API_KEY or upload a recorded voiceover.");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", { method: "POST", signal: AbortSignal.timeout(55000), headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: `Read this narration clearly and naturally, without extra commentary: ${script}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice === "gemini-puck" ? "Puck" : "Kore" } } } } }) });
  if (!response.ok) throw new Error(`Gemini voice unavailable (HTTP ${response.status}). Try again later or upload a voiceover.`);
  const data = await response.json();
  const parts: { inlineData?: { data?: string; mimeType?: string } }[] = data.candidates?.[0]?.content?.parts || [];
  const audio = parts.find((part) => part.inlineData?.data)?.inlineData;
  if (!audio?.data) throw new Error("Gemini did not return narration audio.");
  let bytes: Buffer = Buffer.from(audio.data, "base64");
  if (bytes.length < 1000 || bytes.length > 2_900_000) throw new Error("Narration audio is too long or invalid. Shorten the script to around 100 words.");
  if (bytes.subarray(0, 4).toString() !== "RIFF") {
    if (!/^audio\/(?:L16|pcm)/i.test(audio.mimeType || "")) throw new Error("Unexpected narration format.");
    bytes = pcmToWav(bytes);
  }
  return { audioBase64: bytes.toString("base64"), mimeType: "audio/wav", provider: "gemini", warnings: ["Gemini captions use estimated word timing. Review caption alignment before sharing."] };
}

export async function createSpeech(script: string, voice: string): Promise<Speech> {
  if (!voice.startsWith("eleven-")) return geminiSpeech(script, voice);
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("Set ELEVENLABS_API_KEY or select a Gemini voice.");
  try {
    const headers = { "xi-api-key": key, "Content-Type": "application/json" };
    const subscriptionResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers, signal: AbortSignal.timeout(10000) });
    if (!subscriptionResponse.ok) throw new Error("Free plan could not be verified");
    const subscription = await subscriptionResponse.json();
    if (subscription.tier !== "free" || !Number.isFinite(subscription.character_limit) || !Number.isFinite(subscription.character_count) || subscription.character_count < 0 || subscription.character_limit - subscription.character_count < script.length) throw new Error("Free plan or quota unavailable");
    const id = voice === "eleven-george" ? "JBFqnCBsd6RMkjVDRZzb" : "EXAVITQu4vr4xnSDxMaL";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_128`, { method: "POST", headers, signal: AbortSignal.timeout(45000), body: JSON.stringify({ text: script, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) });
    if (!response.ok) throw new Error("Speech unavailable");
    const data = await response.json();
    if (typeof data.audio_base64 !== "string" || data.audio_base64.length < 1400 || data.audio_base64.length > 3_900_000) throw new Error("Invalid speech audio");
    return { audioBase64: data.audio_base64, mimeType: "audio/mpeg", words: characterAlignment(data.normalized_alignment || data.alignment), provider: "elevenlabs", warnings: ["ElevenLabs Free-plan audio is noncommercial; retain ElevenLabs attribution."] };
  } catch {
    const fallback = await geminiSpeech(script, "gemini-kore");
    return { ...fallback, warnings: ["ElevenLabs Free-plan voice unavailable; used Gemini instead.", ...fallback.warnings] };
  }
}
