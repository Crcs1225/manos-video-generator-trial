// Text-only generation uses a current free-tier model. Speech has its own model.
export const GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
