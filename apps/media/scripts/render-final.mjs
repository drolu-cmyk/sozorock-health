import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const voiceDir = join(root, "public", "gpt-live-campaign");
const output = join(root, "exports", "gpt-live-campaign", "final-voiced-masters");
const cli = join(root, "..", "..", "node_modules", "@remotion", "cli", "remotion-cli.js");
const campaignPath = join(root, "gpt-live-campaign", "campaign.json");
const campaignBuffer = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBuffer.toString("utf8"));
const campaignSha256 = createHash("sha256").update(campaignBuffer).digest("hex");
const methodPath = join(voiceDir, "PRODUCTION-METHOD.json");

if (!existsSync(methodPath)) {
  throw new Error("Final render blocked: PRODUCTION-METHOD.json is missing. Run voice:generate successfully before render:final.");
}

const productionMethod = JSON.parse(readFileSync(methodPath, "utf8"));
if (productionMethod.model !== campaign.production.voiceModel || productionMethod.guideVoice !== campaign.production.guideVoice || productionMethod.residentVoice !== campaign.production.residentVoice || productionMethod.campaignSha256 !== campaignSha256) {
  throw new Error("Final render blocked: the recorded voice-production method does not match campaign.json.");
}

const interruption = campaign.production.interruption;
for (const localeData of Object.values(campaign.locales)) {
  const interrupted = localeData.lines.find((line) => line.id === interruption.interruptedLineId);
  const interrupting = localeData.lines.find((line) => line.id === interruption.interruptingLineId);
  if (!interrupted || !interrupting || interrupting.startMs !== interruption.yieldAtMs || interruption.yieldAtMs <= interrupted.startMs || interruption.yieldAtMs >= interrupted.endMs) {
    throw new Error("Final render blocked: campaign interruption timing is incomplete or inconsistent.");
  }
}

const provenanceByName = new Map(productionMethod.files?.map((file) => [file.name, file]) ?? []);
const voiceAssets = [];
for (const [locale, localeData] of Object.entries(campaign.locales)) {
  for (const line of localeData.lines) {
    const name = `${locale}-${line.id}-${line.speaker}.mp3`;
    const path = join(voiceDir, name);
    const provenance = provenanceByName.get(name);
    if (!existsSync(path) || !provenance) throw new Error(`Final render blocked: missing voice asset or provenance for ${name}.`);
    if (provenance.locale !== locale || provenance.id !== line.id || provenance.speaker !== line.speaker || provenance.text !== line.text) throw new Error(`Final render blocked: ${name} provenance does not match the approved line.`);
    const buffer = readFileSync(path);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (sha256 !== provenance.sha256) throw new Error(`Final render blocked: ${name} does not match its production hash.`);
    const probe = JSON.parse(execFileSync(process.execPath, [cli, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", path], {cwd: root, encoding: "utf8"}));
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    const duration = Number(probe.format.duration);
    const approvedEndMs = line.id === interruption.interruptedLineId ? interruption.yieldAtMs : line.endMs;
    const allocated = (approvedEndMs - line.startMs) / 1000;
    if (!audio || !Number.isFinite(duration) || duration < .2) throw new Error(`Final render blocked: ${name} is not a valid audio asset.`);
    if (duration > allocated + .1) throw new Error(`Final render blocked: ${name} is ${duration.toFixed(2)}s but its approved dialogue window is ${allocated.toFixed(2)}s.`);
    voiceAssets.push({name, sha256, durationSeconds: duration, locale, speaker: line.speaker, startMs: line.startMs, approvedEndMs, allocatedSeconds: allocated, interruptedAtMs: line.id === interruption.interruptedLineId ? interruption.yieldAtMs : null});
  }
}

if (voiceAssets.length !== 28) throw new Error(`Final render blocked: expected 28 validated voice assets; found ${voiceAssets.length}.`);

const formats = [
  {id: "Shorts", format: "shorts", suffix: "youtube-shorts-1080x1920", width: 1080, height: 1920},
  {id: "Instagram", format: "instagram", suffix: "instagram-reels-1080x1920", width: 1080, height: 1920},
  {id: "LinkedIn", format: "linkedin", suffix: "linkedin-1080x1350", width: 1080, height: 1350},
  {id: "X", format: "x", suffix: "x-1280x720", width: 1280, height: 720},
];
const locales = [{id: "En", locale: "en", language: "english"}, {id: "Es", locale: "es", language: "spanish"}];
mkdirSync(output, {recursive: true});

const analyzeLoudness = (path) => {
  const result = spawnSync(process.execPath, [cli, "ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], {cwd: root, encoding: "utf8"});
  if (result.status !== 0) throw new Error(`Final render blocked: loudness analysis failed for ${path}.`);
  const stderr = result.stderr ?? "";
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`Final render blocked: loudness analysis returned no JSON for ${path}.`);
  const report = JSON.parse(stderr.slice(start, end + 1));
  const integratedLufs = Number(report.input_i);
  const truePeakDbtp = Number(report.input_tp);
  const loudnessRangeLu = Number(report.input_lra);
  if (![integratedLufs, truePeakDbtp, loudnessRangeLu].every(Number.isFinite)) throw new Error(`Final render blocked: loudness analysis returned invalid values for ${path}.`);
  if (integratedLufs < -20 || integratedLufs > -14) throw new Error(`Final render blocked: ${path} integrated loudness is ${integratedLufs} LUFS; expected -20 to -14 LUFS.`);
  if (truePeakDbtp > -1) throw new Error(`Final render blocked: ${path} true peak is ${truePeakDbtp} dBTP; expected no higher than -1 dBTP.`);
  if (loudnessRangeLu > 12) throw new Error(`Final render blocked: ${path} loudness range is ${loudnessRangeLu} LU; expected no more than 12 LU.`);
  return {integratedLufs, truePeakDbtp, loudnessRangeLu};
};

const files = [];
for (const locale of locales) {
  for (const format of formats) {
    const composition = `SozoRockLive${locale.id}${format.id}`;
    const props = JSON.stringify({format: format.format, locale: locale.locale, voiceReady: true});
    const stem = `sozorock-health-voice-access-${locale.language}-${format.suffix}-voiced-master-candidate`;
    const videoPath = join(output, `${stem}.mp4`);
    const posterPath = join(output, `${stem}-poster.png`);
    rmSync(videoPath, {force: true});
    rmSync(posterPath, {force: true});
    execFileSync(process.execPath, [cli, "render", "src/index.ts", composition, videoPath, "--codec=h264", "--crf=21", "--audio-codec=aac", "--pixel-format=yuv420p", `--props=${props}`], {cwd: root, stdio: "inherit"});
    execFileSync(process.execPath, [cli, "still", "src/index.ts", `${composition}Poster`, posterPath, `--props=${props}`], {cwd: root, stdio: "inherit"});

    const probe = JSON.parse(execFileSync(process.execPath, [cli, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", videoPath], {cwd: root, encoding: "utf8"}));
    const video = probe.streams.find((stream) => stream.codec_type === "video");
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    const duration = Number(probe.format.duration);
    if (!video || !audio || video.codec_name !== "h264" || audio.codec_name !== "aac" || Math.abs(duration - 80) > .1 || video.width !== format.width || video.height !== format.height || video.avg_frame_rate !== "30/1" || Number(audio.sample_rate) !== 48000 || audio.channels !== 2) {
      throw new Error(`Final render blocked: ${stem}.mp4 failed encoded-master validation.`);
    }
    const loudness = analyzeLoudness(videoPath);
    files.push({name: `${stem}.mp4`, sha256: createHash("sha256").update(readFileSync(videoPath)).digest("hex"), durationSeconds: duration, width: video.width, height: video.height, frameRate: video.avg_frame_rate, videoCodec: video.codec_name, audioCodec: audio.codec_name, audioSampleRate: Number(audio.sample_rate), loudness});
    files.push({name: `${stem}-poster.png`, sha256: createHash("sha256").update(readFileSync(posterPath)).digest("hex"), width: format.width, height: format.height});
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  status: "final-voiced-master-candidate",
  releaseApproved: false,
  durationSeconds: campaign.durationMs / 1000,
  scenario: "illustrative-resident-journey",
  scenarioAccuracy: "Previews non-clinical request details and hands submission to tap or text. No voice persistence, provider match, hub opening, or verified local result is depicted.",
  interactionReference: "GPT-Live continuous interaction",
  speechProduction: {model: productionMethod.model, guideVoice: productionMethod.guideVoice, residentVoice: productionMethod.residentVoice},
  timingGate: {lineWindowsValidated: true, interruption: campaign.production.interruption, edgeFadeMs: campaign.production.interruption.fadeMs},
  loudnessGate: {integratedLufs: [-20, -14], maximumTruePeakDbtp: -1, maximumLoudnessRangeLu: 12},
  disclosure: campaign.production.disclosure,
  humanReviewRequired: ["naturalness and pronunciation", "pause and interruption timing", "caption synchronization", "voice and music mix", "non-clinical boundaries", "final release approval"],
  voiceAssets,
  files,
};
writeFileSync(join(output, "candidate-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(output, "RELEASE-STATUS.txt"), "VOICED MASTER CANDIDATES - NOT RELEASE APPROVED\n\nAll voice assets and encoded streams passed automated validation. Human review and explicit release approval are still required. These candidates must not be represented as GPT-Live output.\n");
process.stdout.write(`${files.length / 2} voiced master candidates rendered; releaseApproved remains false.\n`);
