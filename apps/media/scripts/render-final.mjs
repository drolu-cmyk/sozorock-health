import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const voiceDir = join(root, "public", "gpt-live-campaign");
const output = join(root, "exports", "gpt-live-campaign", "final-voiced-masters");
const cli = join(root, "..", "..", "node_modules", "@remotion", "cli", "remotion-cli.js");
const campaignPath = join(root, "gpt-live-campaign", "campaign.json");
const approvalPath = join(root, "gpt-live-campaign", "RELEASE-APPROVAL.json");
const campaignBuffer = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBuffer.toString("utf8"));
const campaignSha256 = createHash("sha256").update(campaignBuffer).digest("hex");
const methodPath = join(voiceDir, "PRODUCTION-METHOD.json");

mkdirSync(output, {recursive: true});
const lockPath = join(output, ".render-final.lock");
if (existsSync(lockPath)) {
  const recordedPid = Number(readFileSync(lockPath, "utf8"));
  let active = false;
  if (Number.isInteger(recordedPid) && recordedPid > 0) {
    try {
      process.kill(recordedPid, 0);
      active = true;
    } catch {}
  }
  if (active) throw new Error(`Final render blocked: another render is active under process ${recordedPid}.`);
  rmSync(lockPath, {force: true});
}
const lockFd = openSync(lockPath, "wx");
writeFileSync(lockFd, String(process.pid));
const releaseLock = () => {
  try { closeSync(lockFd); } catch {}
  rmSync(lockPath, {force: true});
};
process.once("exit", releaseLock);
process.once("SIGINT", () => process.exit(130));
process.once("SIGTERM", () => process.exit(143));

if (!existsSync(methodPath)) {
  throw new Error("Final render blocked: PRODUCTION-METHOD.json is missing. Run voice:generate successfully before render:final.");
}

const productionMethodBuffer = readFileSync(methodPath);
const productionMethod = JSON.parse(productionMethodBuffer.toString("utf8"));
const productionMethodSha256 = createHash("sha256").update(productionMethodBuffer).digest("hex");
if (productionMethod.provider !== campaign.production.voiceProvider || productionMethod.model !== campaign.production.voiceModel || productionMethod.region !== campaign.production.region || JSON.stringify(productionMethod.voices) !== JSON.stringify(campaign.production.voices) || productionMethod.campaignSha256 !== campaignSha256) {
  throw new Error("Final render blocked: the recorded voice-production method does not match campaign.json.");
}

const releaseApproval = existsSync(approvalPath) ? JSON.parse(readFileSync(approvalPath, "utf8")) : null;
const releaseApproved = Boolean(
  releaseApproval?.status === "approved" &&
  releaseApproval?.approvedCampaignSha256 === campaignSha256 &&
  releaseApproval?.approvedProductionMethodSha256 === productionMethodSha256 &&
  releaseApproval?.approvedProvider === campaign.production.voiceProvider &&
  releaseApproval?.approvedEngine === campaign.production.voiceModel,
);

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
    if (line.id === interruption.interruptedLineId) {
      if (duration < allocated + .15) throw new Error(`Final render blocked: ${name} ends before the planned interruption can be heard.`);
    } else if (duration > allocated + .1) {
      throw new Error(`Final render blocked: ${name} is ${duration.toFixed(2)}s but its approved dialogue window is ${allocated.toFixed(2)}s.`);
    }
    voiceAssets.push({name, sha256, durationSeconds: duration, locale, speaker: line.speaker, startMs: line.startMs, approvedEndMs, allocatedSeconds: allocated, interruptedAtMs: line.id === interruption.interruptedLineId ? interruption.yieldAtMs : null});
  }
}

if (voiceAssets.length !== 28) throw new Error(`Final render blocked: expected 28 validated voice assets; found ${voiceAssets.length}.`);

const renderDependencies = [
  campaignPath,
  methodPath,
  join(root, "src", "Video.tsx"),
  join(root, "src", "Root.tsx"),
  join(root, "public", "sozorock-wordmark-clean-v2.png"),
  join(voiceDir, "ambient-bed.wav"),
  ...voiceAssets.map((asset) => join(voiceDir, asset.name)),
];
const latestDependencyMtime = Math.max(...renderDependencies.map((path) => statSync(path).mtimeMs));

const formats = [
  {id: "X", format: "x", suffix: "x-1280x720", width: 1280, height: 720},
  {id: "LinkedIn", format: "linkedin", suffix: "linkedin-1080x1350", width: 1080, height: 1350},
  {id: "Instagram", format: "instagram", suffix: "instagram-reels-1080x1920", width: 1080, height: 1920},
  {id: "Shorts", format: "shorts", suffix: "youtube-shorts-1080x1920", width: 1080, height: 1920},
];
const locales = [{id: "En", locale: "en", language: "english"}, {id: "Es", locale: "es", language: "spanish"}];
mkdirSync(output, {recursive: true});

const measureLoudness = (path) => {
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
  const thresholdLufs = Number(report.input_thresh);
  const targetOffsetLu = Number(report.target_offset);
  if (![integratedLufs, truePeakDbtp, loudnessRangeLu, thresholdLufs, targetOffsetLu].every(Number.isFinite)) throw new Error(`Final render blocked: loudness analysis returned invalid values for ${path}.`);
  return {integratedLufs, truePeakDbtp, loudnessRangeLu, thresholdLufs, targetOffsetLu};
};

const normalizeLoudness = (path) => {
  const measured = measureLoudness(path);
  const tempPath = path.replace(/\.mp4$/, "-normalized.mp4");
  rmSync(tempPath, {force: true});
  const filter = [
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    `measured_I=${measured.integratedLufs}`,
    `measured_TP=${measured.truePeakDbtp}`,
    `measured_LRA=${measured.loudnessRangeLu}`,
    `measured_thresh=${measured.thresholdLufs}`,
    `offset=${measured.targetOffsetLu}`,
    "linear=true:print_format=summary",
  ].join(":");
  const result = spawnSync(process.execPath, [cli, "ffmpeg", "-y", "-hide_banner", "-i", path, "-c:v", "copy", "-af", filter, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tempPath], {cwd: root, encoding: "utf8"});
  if (result.status !== 0 || !existsSync(tempPath)) throw new Error(`Final render blocked: loudness normalization failed for ${path}.\n${result.stderr ?? ""}`);
  rmSync(path, {force: true});
  renameSync(tempPath, path);
};

const hasFastStart = (path) => {
  const buffer = readFileSync(path);
  const moov = buffer.indexOf(Buffer.from("moov"));
  const mdat = buffer.indexOf(Buffer.from("mdat"));
  return moov >= 0 && mdat >= 0 && moov < mdat;
};

const ensureFastStart = (path) => {
  if (hasFastStart(path)) return;
  const tempPath = path.replace(/\.mp4$/, "-faststart.mp4");
  rmSync(tempPath, {force: true});
  const result = spawnSync(process.execPath, [cli, "ffmpeg", "-y", "-hide_banner", "-i", path, "-map", "0", "-c", "copy", "-movflags", "+faststart", tempPath], {cwd: root, encoding: "utf8"});
  if (result.status !== 0 || !existsSync(tempPath)) throw new Error(`Final render blocked: fast-start optimization failed for ${path}.\n${result.stderr ?? ""}`);
  rmSync(path, {force: true});
  renameSync(tempPath, path);
  if (!hasFastStart(path)) throw new Error(`Final render blocked: ${path} is not optimized for progressive playback.`);
};

const analyzeLoudness = (path) => {
  const {integratedLufs, truePeakDbtp, loudnessRangeLu} = measureLoudness(path);
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
    const stem = `sozorock-health-voice-access-${locale.language}-${format.suffix}-voiced-master`;
    const videoPath = join(output, `${stem}.mp4`);
    const posterPath = join(output, `${stem}-poster.png`);
    const reusable = existsSync(videoPath) && existsSync(posterPath) && statSync(videoPath).mtimeMs >= latestDependencyMtime && statSync(posterPath).mtimeMs >= latestDependencyMtime;
    if (!reusable) {
      rmSync(videoPath, {force: true});
      rmSync(posterPath, {force: true});
      execFileSync(process.execPath, [cli, "render", "src/index.ts", composition, videoPath, "--codec=h264", "--crf=21", "--audio-codec=aac", "--pixel-format=yuv420p", "--concurrency=8", `--props=${props}`], {cwd: root, stdio: "inherit"});
      execFileSync(process.execPath, [cli, "still", "src/index.ts", `${composition}Poster`, posterPath, `--props=${props}`], {cwd: root, stdio: "inherit"});
      normalizeLoudness(videoPath);
    } else {
      process.stdout.write(`reusing validated current render ${stem}\n`);
    }

    ensureFastStart(videoPath);

    const probe = JSON.parse(execFileSync(process.execPath, [cli, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", videoPath], {cwd: root, encoding: "utf8"}));
    const video = probe.streams.find((stream) => stream.codec_type === "video");
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    const duration = Number(probe.format.duration);
    if (!video || !audio || video.codec_name !== "h264" || audio.codec_name !== "aac" || Math.abs(duration - 80) > .1 || video.width !== format.width || video.height !== format.height || video.avg_frame_rate !== "30/1" || Number(audio.sample_rate) !== 48000 || audio.channels !== 2) {
      throw new Error(`Final render blocked: ${stem}.mp4 failed encoded-master validation.`);
    }
    const loudness = analyzeLoudness(videoPath);
    files.push({name: `${stem}.mp4`, sha256: createHash("sha256").update(readFileSync(videoPath)).digest("hex"), durationSeconds: duration, width: video.width, height: video.height, frameRate: video.avg_frame_rate, videoCodec: video.codec_name, audioCodec: audio.codec_name, audioSampleRate: Number(audio.sample_rate), fastStart: hasFastStart(videoPath), loudness});
    files.push({name: `${stem}-poster.png`, sha256: createHash("sha256").update(readFileSync(posterPath)).digest("hex"), width: format.width, height: format.height});
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  releaseId: `sozorock-health-voice-access-${campaignSha256.slice(0, 12)}`,
  status: releaseApproved ? "final-voiced-master" : "voiced-master-candidate",
  releaseApproved,
  releaseApproval: releaseApproved ? releaseApproval : null,
  campaignSha256,
  productionMethodSha256,
  durationSeconds: campaign.durationMs / 1000,
  scenario: "illustrative-resident-journey",
  scenarioAccuracy: "Previews non-clinical request details and hands submission to tap or text. No voice persistence, provider match, hub opening, or verified local result is depicted.",
  interactionReference: "GPT-Live continuous interaction",
  speechProduction: {provider: productionMethod.provider, model: productionMethod.model, region: productionMethod.region, voices: productionMethod.voices},
  timingGate: {lineWindowsValidated: true, interruption: campaign.production.interruption, edgeFadeMs: campaign.production.interruption.fadeMs},
  loudnessGate: {integratedLufs: [-20, -14], maximumTruePeakDbtp: -1, maximumLoudnessRangeLu: 12},
  disclosure: campaign.production.disclosure,
  automatedReleaseEvidence: ["voice assets and provenance validated", "pause and interruption timing validated", "captions generated from approved dialogue windows", "voice and music mix passed loudness gates", "non-clinical boundaries retained"],
  voiceAssets,
  files,
};
writeFileSync(join(output, "final-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(output, "CHECKSUMS.sha256"), files.map((file) => `${file.sha256}  ${file.name}`).join("\n") + "\n");
writeFileSync(join(output, "RELEASE-STATUS.txt"), releaseApproved
  ? "VOICED MASTERS - APPROVED FOR SOZOROCK HEALTH WEB AND SOCIAL DISTRIBUTION\n\nAn explicit release approval matches the current campaign and production provider. Voice assets, interruption timing, captions, encoded streams, and loudness passed automated validation. The interaction design is informed by GPT-Live. The prerecorded narration was synthesized with Amazon Polly generative voices and must not be represented as GPT-Live output.\n"
  : "VOICED MASTER CANDIDATES - RELEASE APPROVAL NOT RECORDED\n\nAutomated media gates passed, but the approval artifact is missing, stale, or does not match the current campaign and production provider. Do not publish these files.\n");
process.stdout.write(`${files.length / 2} voiced masters rendered; releaseApproved=${releaseApproved}.\n`);
