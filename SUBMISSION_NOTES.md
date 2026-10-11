I built a TypeScript/Next.js prototype that accepts a topic or source text and optional images, prepares narration, automatically draws topic illustrations when images are absent, and assembles a captioned MP4 in the browser with ffmpeg.wasm. Illustration and voice generation run concurrently with progress and elapsed-time feedback. It supports script edits, scene ordering, speaking speed, and re-rendering.

Tools: Next.js, React, TypeScript, Gemini for script/voice, optional ElevenLabs Free-plan narration, Wikipedia, Canvas, ffmpeg.wasm, and fflate. Only free-tier API usage is intended; Gemini billing must remain disabled.

The attached 46.7-second MP4 was generated and decoded successfully with the earlier local pipeline before the TypeScript migration. It is preserved as the working trial artifact. The migrated browser renderer and live Gemini/ElevenLabs requests have not yet been verified end-to-end in this restricted environment.

With more time I would test the browser pipeline end-to-end, add quota protection, improve caption alignment, add music/sound effects, and introduce a timeline editor and saved projects.

After the two-hour deadline, the user authorized fixes for a Gemini model 404, repeated fallback visuals, and caption/title overlap. The latest source ZIP includes these later fixes; the source snapshot from within the trial limit is preserved separately as `manos-video-generator-trial-source-2hour.zip`. Sixteen unit tests and five HTTP integration tests pass for the updated code. A new video using the latest fixes still needs manual verification.
