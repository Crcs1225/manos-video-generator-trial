export type GenerationOptions = {
  sourceText: string;
  exactScript: string;
  voice: "gemini-kore" | "gemini-puck" | "eleven-sarah" | "eleven-george" | "upload";
  rate: number;
  captions: boolean;
  rewrite: boolean;
  sourceJobId?: string;
  sceneOrder?: number[];
};

export function generationOptions(value: Record<string, unknown>): GenerationOptions {
  const text = (key: string, maximum: number) => {
    const input = value[key] ?? "";
    if (typeof input !== "string" || input.length > maximum) throw new Error(`${key} must be text of at most ${maximum} characters.`);
    return input.trim();
  };
  const sourceText = text("sourceText", 6000);
  const exactScript = text("exactScript", 2000);
  if (exactScript && (exactScript.split(/\s+/).length < 5 || exactScript.split(/\s+/).length > 180)) throw new Error("Narration must contain 5 to 180 words.");
  const voice = value.voice ?? "gemini-kore";
  if (typeof voice !== "string" || !["gemini-kore", "gemini-puck", "eleven-sarah", "eleven-george", "upload"].includes(voice)) throw new Error("Choose a supported voice.");
  const rate = Number(value.rate ?? 0);
  if (![-20, -10, 0, 10, 20].includes(rate)) throw new Error("Choose a supported speaking speed.");
  for (const field of ["captions", "rewrite"]) if (value[field] !== undefined && typeof value[field] !== "boolean") throw new Error(`${field} must be a boolean.`);
  const sourceJobId = text("sourceJobId", 36) || undefined;
  let sceneOrder: number[] | undefined;
  if (value.sceneOrder !== undefined) {
    if (!Array.isArray(value.sceneOrder) || !value.sceneOrder.length || value.sceneOrder.length > 6 || value.sceneOrder.some((index) => !Number.isInteger(index) || index < 0 || index > 5) || new Set(value.sceneOrder).size !== value.sceneOrder.length) throw new Error("Choose one to six distinct scenes.");
    sceneOrder = value.sceneOrder as number[];
  }
  return { sourceText, exactScript, voice: voice as GenerationOptions["voice"], rate, captions: value.captions !== false, rewrite: value.rewrite !== false, sourceJobId, sceneOrder };
}

export function imageExtension(data: Uint8Array): ".png" | ".jpg" {
  if (data.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => data[index] === byte)) return ".png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return ".jpg";
  throw new Error("Upload JPEG or PNG images only.");
}
