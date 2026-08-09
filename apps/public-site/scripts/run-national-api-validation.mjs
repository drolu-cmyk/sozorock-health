import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appDir, "../..");
const nextBin = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const validator = path.join(appDir, "scripts", "validate-national-api.mjs");
const baseUrl = process.env.EXPLORE_VALIDATION_BASE_URL ?? "http://127.0.0.1:4318";
const parsed = new URL(baseUrl);
if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
  throw new Error("The local national validator may start only a loopback HTTP server.");
}
const port = parsed.port || "4318";
let server;

function stopServer() {
  if (!server?.pid || server.exitCode !== null) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    if (result.status !== 0) server.kill("SIGKILL");
    server.unref();
    return;
  }
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGKILL");
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`National validation server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/explore`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("National validation server did not become ready within 120 seconds.");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServer();
    process.exitCode = 130;
  });
}

try {
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", port], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
      RUNTIME_ENV: "test",
    },
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  await waitForServer();
  const validation = spawn(process.execPath, [validator, baseUrl], {
    cwd: appDir,
    env: process.env,
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    validation.once("error", reject);
    validation.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
} finally {
  stopServer();
}
