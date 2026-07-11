import {execFileSync} from "node:child_process";
import {mkdirSync} from "node:fs";
import {join} from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const output = join(root, "exports", "resident-journey-80s-final");
const remotionCli = join(root, "node_modules", "@remotion", "cli", "remotion-cli.js");
mkdirSync(output, {recursive: true});

const exports = [
  ["SozoRockJourneyShorts", "sozorock-health-resident-journey-youtube-shorts-1080x1920"],
  ["SozoRockJourneyInstagram", "sozorock-health-resident-journey-instagram-reels-1080x1920"],
  ["SozoRockJourneyLinkedIn", "sozorock-health-resident-journey-linkedin-1080x1350"],
  ["SozoRockJourneyX", "sozorock-health-resident-journey-x-1280x720"],
];

for (const [id, file] of exports) {
  execFileSync(process.execPath, [remotionCli, "render", "src/index.ts", id, join(output, `${file}.mp4`), "--codec=h264", "--crf=21", "--audio-codec=aac", "--pixel-format=yuv420p"], {cwd: root, stdio: "inherit"});
  execFileSync(process.execPath, [remotionCli, "still", "src/index.ts", `${id}Poster`, join(output, `${file}-poster.png`)], {cwd: root, stdio: "inherit"});
}
