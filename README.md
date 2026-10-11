# MANOS Video Studio

A TypeScript/Next.js prototype that turns a topic, source text, and optional images into a narrated 1280×720 MP4. FFmpeg runs in the browser through WebAssembly. No Python or system FFmpeg installation is needed.

## Run

Requires Node.js 22.18+ (Node 24 recommended), npm, internet access, and recent desktop Chrome/Edge.

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. Installation prepares browser worker assets automatically; `npm.cmd run setup` can prepare them again.

Copy `.env.example` to `.env.local` if it does not exist. Add your server-side `GEMINI_API_KEY` and optional `ELEVENLABS_API_KEY`. Never prefix keys with NEXT_PUBLIC_. Restart the server after changing keys.

For free-only usage, use a Google AI Studio project with billing disabled. The app cannot determine Gemini billing status from an API key. ElevenLabs speech requires a verified Free-plan subscription and remaining quota; unavailable ElevenLabs falls back to Gemini. Provider limits can change. Do not enable paid billing for this trial.

## Generate and edit

1. Enter a topic. Paste up to 6,000 characters of source text, or leave it empty for Gemini to write from the topic. Wikipedia is a fallback when Gemini is unavailable or rewriting is off.
2. Choose Gemini script rewriting, or check **Speak my text exactly** for a narration of 5–180 words.
3. Upload up to six JPEG/PNG images, 5 MB each. Without uploads, Gemini designs topic illustrations as validated drawing instructions and the browser creates PNGs. Local illustrations provide a fallback. Native paid image-generation models are not used.
4. Choose Gemini Kore/Puck, optional ElevenLabs Sarah/George, or upload a 1–90-second MP3/WAV voiceover (up to 10 MB). Uploaded narration should match the script.
5. Generate, preview, and download the MP4. Illustration and voice requests run concurrently while the UI shows approximate progress, elapsed time, and the current step. Keep the tab open. Revise the script, reorder/remove scenes, change speed or captions, and render another version.
6. Download the ZIP containing the MP4, script, SRT captions, and source notes.

Refreshing clears videos held in browser memory. Download before leaving. Gemini and uploaded-audio captions use estimated timing; ElevenLabs uses returned alignment. ElevenLabs Free-plan output is noncommercial and includes attribution. Wikipedia source notes retain CC BY-SA attribution.

## How it works

Stateless Next.js APIs retrieve source facts and call Gemini 3.5 Flash-Lite for scripts and scene illustration plans, and Gemini 2.5 Flash Preview TTS or ElevenLabs for narration. The text model is shared through `lib/gemini-config.ts`; speech uses a separate model. Keys remain server-side. Images and uploaded audio stay in the browser; AI providers receive narration/source text when selected.

The browser normalizes images, draws topic illustrations and credit cards, generates captions, and uses single-threaded ffmpeg.wasm to encode H.264/AAC MP4. AI illustration instructions allow only bounded geometry, short plain-text labels, and hex colors; no executable code or arbitrary SVG is accepted. AI plans must contain three different compositions; recolored or relabeled copies are rejected. Local fallback scenes depict different details, including typed code, type checking, and a browser result for TypeScript. Titles are placed above the artwork; the bottom band is reserved for smaller captions. The first render downloads about 31 MB of engine assets from jsDelivr, plus the Roboto caption font from Google Fonts' repository. Rendering speed and memory depend on the device. Inputs and timeouts are bounded; generation supports cancellation.

This is an image-based generator with a regeneration editor. Music, sound effects, motion footage, persistent projects, and a timeline editor remain future work.

## Vercel

Import this repository as a Next.js project and add server-side keys to Vercel environment settings. No Python runtime, filesystem jobs, or background worker is used. MP4 encoding happens in the user's browser. Deployment itself has not been performed or verified.

Before exposing a public deployment, add authentication and request limits to protect API quotas. This prototype is intended for a trial/demo.

## Validation and handoff

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:integration
npm.cmd run start -- --port 3102
# In another terminal:
node tests/api-smoke.ts
npm.cmd run handoff
```

All test files are TypeScript. `npm.cmd test` / `npm.cmd run test:unit` run unit tests. Integration tests require a production build, then automatically start a temporary Next.js server with keys disabled and stop it afterward. Run `npm.cmd run test:all` to build and run both suites. These checks do not consume provider credits. Provider behavior is simulated in unit tests; browser rendering and live AI calls still require manual verification.

The source ZIP excludes local keys, dependencies, and environments. `handoff/generated-video.mp4` preserves the previously generated 46.7-second sample from the earlier local pipeline. It is **not evidence of a successful browser render**.

The trial build ran from 2026-10-11 15:36:45 UTC to its 17:36:45 UTC deadline. The original source snapshot is preserved at `handoff/manos-video-generator-trial-source-2hour.zip`. After that deadline, the user explicitly authorized fixes for model availability, repeated visuals, and caption overlap. The latest source ZIP includes those later fixes. See BUILD_LOG.md and SUBMISSION_NOTES.md.

## Lint dependency override

The existing npm override replaces the Next.js ESLint plugin's fast-glob dependency with tinyglobby@0.2.17 to remove its vulnerable braces dependency. Recheck the override when upgrading Next.js lint packages.
