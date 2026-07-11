import {execFileSync} from "node:child_process";
import {mkdirSync} from "node:fs";
import {join} from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const output = join(root, "dist");
mkdirSync(output, {recursive: true});

const videoIds = ["ResidentJourneyYouTube", "ResidentJourneyX", "ResidentJourneyLinkedIn", "ResidentJourneyInstagram"];
for (const id of videoIds) {
  const slug = id.replace("ResidentJourney", "resident-journey-").toLowerCase();
  execFileSync("npx", ["remotion", "render", "src/index.ts", id, join(output, `${slug}.mp4`), "--codec=h264", "--crf=20", "--audio-codec=aac"], {cwd: root, stdio: "inherit", shell: true});
  execFileSync("npx", ["remotion", "still", "src/index.ts", `${id}Still`, join(output, `${slug}.png`)], {cwd: root, stdio: "inherit", shell: true});
}
