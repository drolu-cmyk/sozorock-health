import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = join(root, "exports", "gpt-live-campaign");
const cli = join(root, "..", "..", "node_modules", "@remotion", "cli", "remotion-cli.js");
const campaign = JSON.parse(readFileSync(join(root, "gpt-live-campaign", "campaign.json"), "utf8"));
const videos = readdirSync(output).filter((name) => name.endsWith("-visual-preview.mp4")).sort();
const posters = readdirSync(output).filter((name) => name.endsWith("-visual-preview-poster.png")).sort();
if (videos.length !== 8) throw new Error(`Expected 8 visual previews; found ${videos.length}`);
if (posters.length !== 8) throw new Error(`Expected 8 visual preview posters; found ${posters.length}`);

const expectedDimensions = (name) => {
  if (name.includes("-x-1280x720-")) return [1280, 720];
  if (name.includes("-linkedin-1080x1350-")) return [1080, 1350];
  return [1080, 1920];
};

const files = videos.map((name) => {
  const path = join(output, name);
  const probe = JSON.parse(execFileSync(process.execPath, [cli, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", path], {cwd: root, encoding: "utf8"}));
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format.duration);
  const [width, height] = expectedDimensions(name);
  if (!video || !audio) throw new Error(`${name} must contain video and audio streams`);
  if (Math.abs(duration - 80) > .1) throw new Error(`${name} duration is ${duration}, expected 80 seconds`);
  if (video.codec_name !== "h264" || audio.codec_name !== "aac") throw new Error(`${name} must be H.264/AAC`);
  if (video.width !== width || video.height !== height) throw new Error(`${name} is ${video.width}x${video.height}; expected ${width}x${height}`);
  if (video.avg_frame_rate !== "30/1") throw new Error(`${name} frame rate is ${video.avg_frame_rate}; expected 30/1`);
  if (Number(audio.sample_rate) !== 48000 || audio.channels !== 2) throw new Error(`${name} audio must be 48 kHz stereo`);
  return {name, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), durationSeconds: duration, width: video.width, height: video.height, frameRate: video.avg_frame_rate, videoCodec: video.codec_name, audioCodec: audio.codec_name, audioSampleRate: Number(audio.sample_rate)};
});

const posterFiles = posters.map((name) => {
  const path = join(output, name);
  const probe = JSON.parse(execFileSync(process.execPath, [cli, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path], {cwd: root, encoding: "utf8"}));
  const image = probe.streams.find((stream) => stream.codec_type === "video");
  const [width, height] = expectedDimensions(name);
  if (!image || image.width !== width || image.height !== height) throw new Error(`${name} must be ${width}x${height}`);
  return {name, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), width: image.width, height: image.height};
});

const voiceDir = join(root, "public", "gpt-live-campaign");
const expectedVoiceAssets = Object.entries(campaign.locales).flatMap(([locale, localeData]) => localeData.lines.map((line) => join(voiceDir, `${locale}-${line.id}-${line.speaker}.mp3`)));
const voiceAssetsAvailable = expectedVoiceAssets.every((path) => existsSync(path)) && existsSync(join(voiceDir, "PRODUCTION-METHOD.json"));

const manifest = {
  generatedAt: new Date().toISOString(),
  status: "visual-preview",
  releaseApproved: false,
  durationSeconds: campaign.durationMs / 1000,
  scenario: "illustrative-resident-journey",
  scenarioAccuracy: "Previews non-clinical request details and hands submission to tap or text. No voice persistence, provider match, hub opening, or verified local result is depicted.",
  interactionReference: "GPT-Live continuous interaction",
  voiceProduction: "pending",
  voiceAssetsAvailable,
  voiceBlocker: "The configured OpenAI project returned billing_not_active during approved speech generation.",
  accuracy: "These files contain an ambient bed and visualized dialogue only. They are not final voiced masters and are not represented as GPT-Live output.",
  plannedVoiceProduction: voiceAssetsAvailable ? "A complete, provenance-recorded OpenAI speech asset set is available for the separate fail-closed final render path." : "No complete, provenance-recorded OpenAI speech asset set is available. Final voiced masters remain pending.",
  disclosure: campaign.production.disclosure,
  music: "Original programmatic ambient bed; no third-party recording or license dependency.",
  files,
  posters: posterFiles
};
writeFileSync(join(output, "campaign-manifest.json"), JSON.stringify(manifest, null, 2));
process.stdout.write(`${files.length} campaign previews verified\n`);
