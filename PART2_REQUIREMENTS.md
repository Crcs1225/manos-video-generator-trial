# MANOS Corp — Part 2 trial requirements

Build a prototype automated video generator that accepts a topic and produces a raw MP4. Automate as much as possible. Content may include footage, images, voiceover, captions, and music.

## Mandatory trial constraints

- Maximum actual build time: two hours.
- Set a timer before starting; stop at the deadline.
- Hand off whatever works, even if incomplete. Production polish is unnecessary.
- Any language, framework, API, AI tool, or no-code approach is allowed.
- Submit Part 1 and Part 2 in the ticket within 72 hours of receiving the trial document. The receipt time and Part 1 submission are outside this repository's known context.

## Required handoff

1. Source code through a Git repository link or ZIP.
2. An MP4 produced by the prototype, even if rough or partially broken; a Drive link is acceptable.
3. A short explanation of the pipeline, tools/AI used, and what would be added next.

## Approved prototype scope

- Local Next.js app plus independently runnable Python worker.
- Free online tools; no paid API or API keys.
- Wikipedia-based script assembly, Wikimedia images with fact-card fallback, edge-tts narration/captions, FFmpeg assembly.
- Landscape 1280×720 output, English narration, roughly 30–45 seconds plus credits.
- Images first. Defer yt-dlp footage, music, deployment, and LLM integration.
- Record the build start/deadline in BUILD_LOG.md and package the sample plus source in handoff/.

