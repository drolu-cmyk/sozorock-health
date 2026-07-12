import {execFileSync} from "node:child_process";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "..", "..", "node_modules", "@remotion", "cli", "remotion-cli.js");
const output = join(root, "public", "gpt-live-campaign", "ambient-bed.wav");

execFileSync(process.execPath, [cli, "ffmpeg", "-y",
  "-f", "lavfi", "-i", "sine=frequency=110:sample_rate=48000:duration=80",
  "-f", "lavfi", "-i", "sine=frequency=164.81:sample_rate=48000:duration=80",
  "-filter_complex", "[0:a]volume=0.022[a0];[1:a]volume=0.012[a1];[a0][a1]amix=inputs=2:duration=longest",
  "-c:a", "pcm_s16le", output
], {cwd: root, stdio: "inherit"});
