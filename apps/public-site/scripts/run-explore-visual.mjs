import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appDir, "../..");
const nextBin = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(repositoryRoot, "node_modules", "@playwright", "test", "cli.js");
const serverUrl = "http://127.0.0.1:4182/explore";

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
    if (server.exitCode !== null) throw new Error(`Explore test server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(serverUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Explore test server did not become ready within 120 seconds.");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServer();
    process.exitCode = 130;
  });
}

try {
  server = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "4182"],
    {
      cwd: appDir,
      env: { ...process.env, PLAYWRIGHT_TEST: "1" },
      stdio: "inherit",
      detached: process.platform !== "win32",
    },
  );
  await waitForServer();
  const test = spawn(
    process.execPath,
    [playwrightCli, "test", "e2e/explore.visual.spec.ts", ...process.argv.slice(2)],
    { cwd: appDir, env: process.env, stdio: "inherit" },
  );
  const code = await new Promise((resolve, reject) => {
    test.once("error", reject);
    test.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
} finally {
  stopServer();
}
