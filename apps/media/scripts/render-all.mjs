import {execFileSync} from "node:child_process";
import {readFileSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const output = join(root, "exports", "gpt-live-campaign");
const remotionCli = join(root, "..", "..", "node_modules", "@remotion", "cli", "remotion-cli.js");
const campaign = JSON.parse(readFileSync(join(root, "gpt-live-campaign", "campaign.json"), "utf8"));
mkdirSync(output, {recursive: true});

const formats = [
  ["Shorts", "youtube-shorts-1080x1920"],
  ["Instagram", "instagram-reels-1080x1920"],
  ["LinkedIn", "linkedin-1080x1350"],
  ["X", "x-1280x720"],
];
const locales = [["En", "en", "english"], ["Es", "es", "spanish"]];
const speakerLabels = {
  en: {resident: "RENATA", guide: "VOICE ACCESS", narrator: "VOICE ACCESS"},
  es: {resident: "RENATA", guide: "ACCESO POR VOZ", narrator: "ACCESO POR VOZ"},
};

const stamp = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms % 3600000 / 60000);
  const seconds = Math.floor(ms % 60000 / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${String(millis).padStart(3,"0")}`;
};

for (const [, code, language] of locales) {
  const lines = campaign.locales[code].lines;
  writeFileSync(join(output, `sozorock-health-voice-access-${language}-captions.json`), JSON.stringify(lines.map(({text,startMs,endMs}) => ({text,startMs,endMs,timestampMs:null,confidence:null})), null, 2));
  writeFileSync(join(output, `sozorock-health-voice-access-${language}-captions.vtt`), `WEBVTT\n\n${lines.map((line, index) => `${index+1}\n${stamp(line.startMs)} --> ${stamp(line.endMs)}\n${line.text}`).join("\n\n")}\n`);
  writeFileSync(join(output, `sozorock-health-voice-access-${language}-transcript.txt`), lines.map((line) => `${stamp(line.startMs)} ${speakerLabels[code][line.speaker]}: ${line.text}`).join("\n"));
}

for (const [localeId, , language] of locales) {
  for (const [formatId, suffix] of formats) {
    const id = `SozoRockLive${localeId}${formatId}`;
    const file = `sozorock-health-voice-access-${language}-${suffix}-visual-preview`;
    const videoPath = join(output, `${file}.mp4`);
    const posterPath = join(output, `${file}-poster.png`);
    rmSync(videoPath, {force: true});
    rmSync(posterPath, {force: true});
    execFileSync(process.execPath, [remotionCli, "render", "src/index.ts", id, videoPath, "--codec=h264", "--crf=21", "--audio-codec=aac", "--pixel-format=yuv420p"], {cwd: root, stdio: "inherit"});
    execFileSync(process.execPath, [remotionCli, "still", "src/index.ts", `${id}Poster`, posterPath], {cwd: root, stdio: "inherit"});
  }
}
