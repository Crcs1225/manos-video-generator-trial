"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { FormEvent } from "react";
import type { Job, Speech, Story } from "@/lib/video-types";
import { generationOptions } from "@/lib/generation-input";
import type { VisualPlan } from "@/lib/illustration";
import { localIllustrations } from "@/lib/illustration";

type DisplayJob = Job & { id: string; videoUrl?: string };
const stages = [
  { key: "content", title: "Find the story", detail: "Write a short script from your topic or source text." },
  { key: "visuals", title: "Collect the visuals", detail: "Gather images or make illustrated fact cards." },
  { key: "narration", title: "Give it a voice", detail: "Create narration and synchronized captions." },
  { key: "rendering", title: "Build the video", detail: "Combine everything into a downloadable MP4." },
];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [job, setJob] = useState<DisplayJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [exactSource, setExactSource] = useState(false);
  const [uploads, setUploads] = useState<File[]>([]);
  const [voice, setVoice] = useState("gemini-kore");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rate, setRate] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [rewrite, setRewrite] = useState(true);
  const [editScript, setEditScript] = useState("");
  const [sceneOrder, setSceneOrder] = useState<number[]>([]);
  const [config, setConfig] = useState({ gemini: false, elevenlabs: false });
  const [previousVideo, setPreviousVideo] = useState<string | null>(null);
  const [previousJob, setPreviousJob] = useState<DisplayJob | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const urls = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  const busy = submitting || job?.status === "running";
  const complete = job?.status === "completed";
  const stageIndex = complete ? stages.length : stages.findIndex((stage) => stage.key === job?.stage);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal }).then((response) => response.json()).then(setConfig).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const ownedUrls = urls.current;
    return () => { controller.current?.abort(); ownedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  async function generate(event: FormEvent) {
    event.preventDefault();
    await submit(false);
  }

  async function submit(editing: boolean) {
    if (busy) return;
    if (editing && (!job || !editScript.trim() || !sceneOrder.length)) return;
    if (job?.videoUrl) { setPreviousVideo(job.videoUrl); setPreviousJob(job); }
    setSubmitting(true);
    startedAt.current = Date.now(); setElapsed(0); setProgress(2);
    setError("");
    let started = false;
    const id = crypto.randomUUID();
    const runController = new AbortController();
    controller.current = runController;
    const signal = runController.signal;
    try {
      generationOptions({ sourceText: editing ? "" : sourceText, exactScript: editing ? editScript : exactSource ? sourceText : "", voice, rate, captions, rewrite });
      if (voice === "upload" && !audioFile) throw new Error("Upload an MP3 or WAV voiceover first.");
      if (editing && !job?.story) throw new Error("No source video is available to edit.");
      const prior = job;
      started = true;
      setJob({ id, topic, status: "running", stage: "content", message: "Preparing the narration script", warnings: [] });
      let story: Story;
      if (editing) story = { ...prior!.story!, title: topic, script: editScript, scriptGenerator: "user" };
      else {
        const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ topic, sourceText, exactScript: exactSource ? sourceText : "", rewrite }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not prepare narration.");
        story = data;
      }
      const { prepareScenes, renderVideo } = await import("@/lib/browser-video");
      setProgress(20);
      setJob((current) => ({ ...current!, resolvedTitle: story.title, script: story.script, sourceUrl: story.sourceUrl, stage: "visuals", message: uploads.length || editing ? "Preparing images and narration" : "Generating topic illustrations and narration in parallel" }));
      const visualWarnings: string[] = [];
      const scenesPromise = (async () => {
        let plan: VisualPlan | undefined;
        if (!editing && !uploads.length) {
          try {
            const response = await fetch("/api/visuals", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ topic: story.title, script: story.script }) });
            if (!response.ok) throw new Error("Illustration design unavailable.");
            plan = await response.json();
          } catch (error) {
            if (signal.aborted) throw error;
            plan = { scenes: localIllustrations(story.title, story.script), warnings: ["Illustration service unavailable; generated local topic illustrations."] };
          }
          visualWarnings.push(...plan!.warnings);
        }
        const scenes = editing ? sceneOrder.map((index) => prior!.scenes![index]) : await prepareScenes(uploads, story, plan?.scenes);
        if (signal.aborted) {
          if (!editing) scenes.forEach((scene) => URL.revokeObjectURL(scene.previewUrl));
          throw new Error("Generation canceled.");
        }
        scenes.forEach((scene) => urls.current.add(scene.previewUrl));
        setProgress((current) => Math.max(current, 35));
        return scenes;
      })();
      const speechPromise = (async (): Promise<Speech | Blob> => {
        if (voice === "upload") return audioFile!;
        const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ script: story.script, voice }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not generate narration.");
        setProgress((current) => Math.max(current, 45));
        return data;
      })();
      const [scenes, speech] = await Promise.all([scenesPromise, speechPromise]);
      const warnings = [...story.warnings, ...visualWarnings, ...(speech instanceof Blob ? ["Uploaded voiceover captions use estimated timing."] : speech.warnings)];
      setProgress(50);
      const result = await renderVideo(story, scenes, speech, rate, captions, (message, percent) => { setJob((current) => ({ ...current!, stage: "rendering", message, warnings })); if (percent !== undefined) setProgress((current) => Math.max(current, percent)); }, signal);
      if (signal.aborted) throw new Error("Generation canceled.");
      const videoUrl = URL.createObjectURL(result.blob); urls.current.add(videoUrl);
      setProgress(100);
      setJob({ id, topic, status: "completed", stage: "completed", message: "Your MP4 is ready", resolvedTitle: story.title, script: story.script, sourceUrl: story.sourceUrl, durationSeconds: Math.round(result.duration * 10) / 10, sizeBytes: result.blob.size, warnings, sceneCount: scenes.length, voice, rate, captions, videoUrl, story, scenes, captionsText: result.captionText });
      setEditScript(story.script); setSceneOrder(scenes.map((_, index) => index));
    } catch (failure) {
      const message = signal.aborted ? "Generation canceled." : failure instanceof Error ? failure.message : String(failure);
      runController.abort();
      setError(message);
      if (started) setJob((current) => ({ ...current!, status: "failed", stage: "failed", message, error: message }));
    } finally { setSubmitting(false); }
  }

  async function downloadPackage() {
    if (!job?.videoUrl) return;
    const { zipSync, strToU8 } = await import("fflate");
    const bytes = new Uint8Array(await (await fetch(job.videoUrl)).arrayBuffer());
    const zip = zipSync({ "output.mp4": [bytes, { level: 0 }], "script.txt": strToU8(job.script || ""), "captions.srt": strToU8(job.captionsText || ""), "credits.json": strToU8(JSON.stringify({ story: job.story, warnings: job.warnings }, null, 2)) });
    const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: "application/zip" }));
    urls.current.add(url); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "manos-video.zip"; anchor.click();
  }

  return (
    <div className="studio">
      <header className="masthead">
        <Link className="wordmark" href="/" aria-label="Manos Video Studio home">MANOS<span>VIDEO STUDIO</span></Link>
        <span className="prototype-tag"><span className="status-dot" />TRIAL PROTOTYPE</span>
      </header>
      <main>
        <div className="intro">
          <span className="eyebrow">FROM AN IDEA TO A PLAYABLE VIDEO</span>
          <h1>Make a short<br /><em>explainer.</em></h1>
          <p>Bring your text and images. Create a narrated video, then edit the story, scenes, and voice.</p>
        </div>
        <div className="workspace">
          <section className="input-panel" aria-labelledby="topic-heading">
            <div className="panel-heading"><span className="section-number">01</span><h2 id="topic-heading">Your topic</h2></div>
            <form onSubmit={generate}>
              <label htmlFor="topic">What should the video explain?</label>
              <textarea id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} required disabled={busy} placeholder="For example, the Solar System" rows={3} aria-describedby="topic-help" />
              <div className="field-meta"><span id="topic-help">A specific subject works best.</span><span>{topic.length}/200</span></div>
              <div className="suggestions"><span>TRY</span>{["Solar System", "Mount Fuji", "Coffee"].map((example) => <button type="button" key={example} disabled={busy} onClick={() => setTopic(example)}>{example}</button>)}</div>
              <label htmlFor="source-text">Source text or narration <span className="optional">optional</span></label>
              <textarea id="source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} maxLength={6000} disabled={busy} placeholder="Paste facts or your narration. Leave blank for Gemini to write from your topic, or Wikipedia when AI is off." rows={5} />
              <label className="check-control"><input type="checkbox" checked={exactSource} disabled={busy} onChange={(event) => setExactSource(event.target.checked)} />Speak my text exactly (5–180 words)</label>
              <label htmlFor="images">Your images <span className="optional">optional</span></label>
              <input id="images" className="file-input" type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length > 6 || files.some((file) => file.size > 5 * 1024 * 1024)) { setError("Choose up to six JPEG/PNG images, each no larger than 5 MB."); event.target.value = ""; return; }
                setError(""); setUploads(files);
              }} />
              <p className="field-hint">Up to 6 JPEG/PNG images, 5 MB each. With no uploads, topic illustrations are generated automatically.</p>
              {!!uploads.length && <ol className="upload-list">{uploads.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" disabled={busy || index === 0} aria-label={`Move ${file.name} earlier`} onClick={() => setUploads((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button type="button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => setUploads((current) => current.filter((_, position) => position !== index))}>×</button></li>)}</ol>}
              <div className="voice-controls">
                <label htmlFor="voice">Narration voice<select id="voice" value={voice} disabled={busy} onChange={(event) => setVoice(event.target.value)}><option value="gemini-kore" disabled={!config.gemini}>Kore · Gemini Free tier</option><option value="gemini-puck" disabled={!config.gemini}>Puck · Gemini Free tier</option><option value="eleven-sarah" disabled={!config.elevenlabs}>Sarah · ElevenLabs Free</option><option value="eleven-george" disabled={!config.elevenlabs}>George · ElevenLabs Free</option><option value="upload">Upload my voiceover</option></select></label>
                <label htmlFor="rate">Speaking speed<select id="rate" value={rate} disabled={busy} onChange={(event) => setRate(Number(event.target.value))}>{[-20, -10, 0, 10, 20].map((value) => <option key={value} value={value}>{value === 0 ? "Normal" : `${value > 0 ? "+" : ""}${value}%`}</option>)}</select></label>
              </div>
              {voice === "upload" && <><label htmlFor="voiceover">MP3 or WAV voiceover (1–90 seconds)</label><input id="voiceover" className="file-input" type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > 10 * 1024 * 1024) { setError("Voiceover limit is 10 MB."); return; } setAudioFile(file || null); }} /></>}
              <label className="check-control"><input type="checkbox" checked={captions} disabled={busy} onChange={(event) => setCaptions(event.target.checked)} />Show captions in the video</label>
              <label className="check-control"><input type="checkbox" checked={rewrite} disabled={busy || exactSource} onChange={(event) => setRewrite(event.target.checked)} />Improve the script with Gemini {config.gemini ? "· key configured" : "· key needed"}</label>
              {voice.startsWith("eleven-") && <p className="field-hint">ElevenLabs Free-plan narration uses monthly credits and is for noncommercial use. If unavailable, Gemini is used.</p>}
              <button className="generate-button" disabled={busy || !topic.trim()} type="submit">{busy ? <><span className="spinner" />Generating your video</> : <>Generate video <span aria-hidden="true">↗</span></>}</button>
              <p className="format-note">16:9 landscape · 720p · English narration</p>
              {busy && <button className="restore-button" type="button" onClick={() => controller.current?.abort()}>Cancel generation</button>}
            </form>
            {(error || job?.error) && <div className="error-message" role="alert"><strong>Generation needs attention</strong><p>{error || job?.error}</p></div>}
            {previousVideo && <p className="field-hint"><a href={previousVideo} target="_blank" rel="noreferrer">Open the previous version</a>{previousJob && !busy && job?.id !== previousJob.id && <button className="restore-button" type="button" onClick={() => { setError(""); setJob(previousJob); setTopic(previousJob.topic); setVoice(previousJob.voice || "gemini-kore"); setRate(previousJob.rate || 0); setCaptions(previousJob.captions !== false); setEditScript(previousJob.script || ""); setSceneOrder(previousJob.scenes?.map((_, index) => index) || []); }}>Return to edit the previous version</button>}</p>}
            <div className="pipeline" aria-label="Generation stages">
              {stages.map((stage, index) => {
                const done = complete || (job?.status === "running" && index < stageIndex);
                const active = busy && index === stageIndex;
                return <div className={`pipeline-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={stage.key}>
                  <span className="step-marker" aria-hidden="true">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{stage.title}</h3><p>{active ? job?.message : stage.detail}</p></div>
                  {active && <span className="small-spinner" aria-hidden="true" />}
                </div>;
              })}
            </div>
          </section>
          <section className="output-panel" aria-labelledby="output-heading">
            <div className="panel-heading"><span className="section-number">02</span><h2 id="output-heading">The output</h2><span className={`output-badge ${complete ? "ready" : ""}`}>{complete ? "READY" : busy ? "IN PROGRESS" : "PREVIEW"}</span></div>
            <div className="video-frame">
              {complete && job.videoUrl ? <video key={job.id} controls preload="metadata" src={job.videoUrl} aria-label={`${job.resolvedTitle} generated explainer`} /> : <div className="preview-placeholder">
                <div className="preview-top"><span>MANOS / EXPLAINER</span><span>1280 × 720</span></div>
                <div className="orbit-art" aria-hidden="true"><div /><div /><div /><span /></div>
                <div className="preview-copy"><span>{busy ? "BUILDING YOUR STORY" : "YOUR NEXT STORY"}</span><h3>{job?.resolvedTitle || job?.topic || "Starts with a topic."}</h3><p>{busy ? job?.message : "Your generated video will appear here."}</p></div>
              </div>}
            </div>
            {busy && <div className="generation-progress" role="status">
              <div><strong>{Math.floor(progress)}% · {job?.message || "Starting generation"}</strong><span>Elapsed {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span></div>
              <progress max={100} value={progress} aria-label="Estimated workflow progress" />
              <p>Workflow progress is approximate. Generation may take several minutes; the first render downloads the video engine. Keep this tab open.</p>
            </div>}
            <div className="output-summary" aria-live="polite">
              <div><h3>{complete ? job.resolvedTitle : busy ? "Turning your topic into a video" : "Ready when you are"}</h3><p>{complete ? `${job.durationSeconds}s · ${((job.sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB · MP4` : busy ? "You can follow each step on the left." : "Most videos take a few minutes to generate."}</p></div>
              {complete && job.videoUrl && <a className="download-button" href={job.videoUrl} download="output.mp4">Download MP4 <span aria-hidden="true">↓</span></a>}
            </div>
            {complete && job.script && <details className="script-panel"><summary>Read the narration script <span aria-hidden="true">+</span></summary><p>{job.script}</p>{job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noreferrer">Read the source on Wikipedia ↗</a>}</details>}
            {complete && !!job.sceneCount && <div className="video-editor">
              <h3>Edit this video</h3><p>Revise narration, reorder or remove scenes, and adjust the voice or captions on the left. Render a new version when ready.</p>
              <label htmlFor="edit-script">Narration (5–180 words)</label><textarea id="edit-script" rows={6} maxLength={2000} disabled={busy} value={editScript} onChange={(event) => setEditScript(event.target.value)} />
              <div className="scene-list">{sceneOrder.map((index, position) => <div className="scene-card" key={index}>
                <Image unoptimized src={job.scenes![index].previewUrl} alt={`Scene ${index + 1}`} width={240} height={135} />
                <div><span>Scene {position + 1}</span><button type="button" disabled={busy || position === 0} aria-label={`Move scene ${position + 1} earlier`} onClick={() => setSceneOrder((current) => { const next = [...current]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; return next; })}>↑</button><button type="button" disabled={busy || sceneOrder.length === 1} aria-label={`Remove scene ${position + 1}`} onClick={() => setSceneOrder((current) => current.filter((item) => item !== index))}>×</button></div>
              </div>)}</div>
              <button className="generate-button" type="button" disabled={busy || !editScript.trim() || !sceneOrder.length} onClick={() => void submit(true)}>{submitting ? "Starting render…" : "Render edited version"}</button>
              <button className="restore-button" type="button" disabled={busy} onClick={() => void downloadPackage().catch(() => setError("Could not package the video."))}>Download video, script, captions, and credits as ZIP</button>
            </div>}
            {!!job?.warnings?.length && <div className="warnings"><strong>A note about this video</strong>{job.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
            <div className="output-footnote"><span className="footnote-line" /><p>Images and MP4 rendering stay in your browser. AI services receive narration text when selected. Keep this tab open while rendering; refreshing clears local videos.</p></div>
          </section>
        </div>
      </main>
      <footer><span>MANOS CORP / PART 2</span><span>A small prototype. A complete pipeline.</span></footer>
    </div>
  );
}
