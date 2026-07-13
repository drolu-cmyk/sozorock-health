import {copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {assertCurrentReleaseApproval} from "./release-gate.mjs";

const mediaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(mediaRoot, "..", "..");
const sourceDir = join(mediaRoot, "exports", "gpt-live-campaign", "final-voiced-masters");
const destinationDir = join(repoRoot, "apps", "public-site", "public", "media", "voice-access");
const stagingDir = `${destinationDir}.staging-${process.pid}`;
const backupDir = `${destinationDir}.backup-${process.pid}`;
const manifest = JSON.parse(readFileSync(join(sourceDir, "final-manifest.json"), "utf8"));
const campaignPath = join(mediaRoot, "gpt-live-campaign", "campaign.json");
const campaignBuffer = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBuffer.toString("utf8"));
const campaignSha256 = createHash("sha256").update(campaignBuffer).digest("hex");
const approval = JSON.parse(readFileSync(join(mediaRoot, "gpt-live-campaign", "RELEASE-APPROVAL.json"), "utf8"));
const productionMethodBuffer = readFileSync(join(mediaRoot, "public", "gpt-live-campaign", "PRODUCTION-METHOD.json"));
const productionMethod = JSON.parse(productionMethodBuffer.toString("utf8"));
const productionMethodSha256 = createHash("sha256").update(productionMethodBuffer).digest("hex");
const renderLock = join(sourceDir, ".render-final.lock");

if (existsSync(renderLock)) throw new Error("Web publication blocked: a final render is still active.");
assertCurrentReleaseApproval({manifest, campaignSha256, approval, productionMethod, productionMethodSha256});

const manifestFiles = new Map(manifest.files.map((file) => [file.name, file]));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

mkdirSync(dirname(destinationDir), {recursive: true});
rmSync(stagingDir, {recursive: true, force: true});
rmSync(backupDir, {recursive: true, force: true});
mkdirSync(stagingDir, {recursive: true});

const clock = (milliseconds) => {
  const total = Math.max(0, milliseconds);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

const localeConfig = {
  en: {
    language: "English",
    source: "english",
    labels: {resident: "Renata", guide: "Voice Access", narrator: "Narrator"},
    music: "Soft instrumental music",
    title: "Voice Access: an illustrative resident journey",
    note: "This film illustrates non-clinical support. SozoRock Health does not diagnose, treat, prescribe, or replace licensed professionals.",
  },
  es: {
    language: "Español",
    source: "spanish",
    labels: {resident: "Renata", guide: "Voice Access", narrator: "Narrador"},
    music: "Música instrumental suave",
    title: "Voice Access: un recorrido ilustrativo para residentes",
    note: "Este video ilustra apoyo no clínico. SozoRock Health no diagnostica, trata, receta ni reemplaza a profesionales con licencia.",
  },
};

const published = [];

for (const [locale, config] of Object.entries(localeConfig)) {
  const sourceStem = `sozorock-health-voice-access-${config.source}-x-1280x720-voiced-master`;
  const destinationStem = `sozorock-health-voice-access-${config.source}`;
  const sourceVideo = join(sourceDir, `${sourceStem}.mp4`);
  const sourcePoster = join(sourceDir, `${sourceStem}-poster.png`);
  const videoRecord = manifestFiles.get(`${sourceStem}.mp4`);
  const posterRecord = manifestFiles.get(`${sourceStem}-poster.png`);
  if (!videoRecord || !posterRecord || sha256(sourceVideo) !== videoRecord.sha256 || sha256(sourcePoster) !== posterRecord.sha256) {
    throw new Error(`Web publication blocked: ${sourceStem} does not match the final manifest.`);
  }
  if (videoRecord.width !== 1280 || videoRecord.height !== 720 || Math.abs(videoRecord.durationSeconds - 80) > .1 || videoRecord.videoCodec !== "h264" || videoRecord.audioCodec !== "aac" || videoRecord.audioSampleRate !== 48000 || videoRecord.fastStart !== true || posterRecord.width !== 1280 || posterRecord.height !== 720) {
    throw new Error(`Web publication blocked: ${sourceStem} does not meet the website media contract.`);
  }
  const destinationVideo = join(stagingDir, `${destinationStem}.mp4`);
  const destinationPoster = join(stagingDir, `${destinationStem}-poster.png`);
  copyFileSync(sourceVideo, destinationVideo);
  copyFileSync(sourcePoster, destinationPoster);
  if (sha256(destinationVideo) !== videoRecord.sha256 || sha256(destinationPoster) !== posterRecord.sha256) throw new Error(`Web publication blocked: ${sourceStem} changed during publication.`);

  const cues = [
    "WEBVTT",
    "",
    `${clock(0)} --> ${clock(1100)}`,
    `[${config.music}]`,
    "",
  ];
  const transcript = [config.title, "", config.note, ""];
  for (const line of campaign.locales[locale].lines) {
    const endMs = line.id === campaign.production.interruption.interruptedLineId ? campaign.production.interruption.yieldAtMs : line.endMs;
    const label = config.labels[line.speaker];
    cues.push(`${clock(line.startMs)} --> ${clock(endMs)}`, `[${label}] ${line.text}`, "");
    transcript.push(`${label}: ${line.text}`);
  }
  transcript.push("", `[${config.music}]`);

  const captionsPath = join(stagingDir, `${destinationStem}.vtt`);
  const transcriptPath = join(stagingDir, `${destinationStem}-transcript.txt`);
  writeFileSync(captionsPath, cues.join("\n"));
  writeFileSync(transcriptPath, transcript.join("\n"));
  published.push({
    locale,
    video: `${destinationStem}.mp4`,
    videoSha256: videoRecord.sha256,
    poster: `${destinationStem}-poster.png`,
    posterSha256: posterRecord.sha256,
    captions: `${destinationStem}.vtt`,
    captionsSha256: sha256(captionsPath),
    transcript: `${destinationStem}-transcript.txt`,
    transcriptSha256: sha256(transcriptPath),
  });
}

writeFileSync(join(stagingDir, "publication-manifest.json"), JSON.stringify({
  publishedAt: new Date().toISOString(),
  releaseId: manifest.releaseId,
  campaignSha256,
  sourceManifestStatus: manifest.status,
  releaseApproved: manifest.releaseApproved,
  durationSeconds: manifest.durationSeconds,
  files: published,
}, null, 2));

try {
  if (existsSync(destinationDir)) renameSync(destinationDir, backupDir);
  renameSync(stagingDir, destinationDir);
  rmSync(backupDir, {recursive: true, force: true});
} catch (error) {
  if (!existsSync(destinationDir) && existsSync(backupDir)) renameSync(backupDir, destinationDir);
  rmSync(stagingDir, {recursive: true, force: true});
  throw error;
}

process.stdout.write("published localized voiced landscape masters, posters, captions, and transcripts to the public site\n");
