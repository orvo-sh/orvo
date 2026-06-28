import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const waitForServer = async (url: string, server?: ChildProcess) => {
  const timeoutMs = 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (server && server.exitCode !== null) {
      throw new Error(`App server exited early with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok || response.status === 405) {
        return;
      }
    } catch {
      // Retry until the server is reachable.
    }

    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 500));
  }

  throw new Error(`App server did not become ready within ${timeoutMs}ms`);
};

const TEST_APP_PORT = 42173;
const TEST_APP_ORIGIN = `http://127.0.0.1:${TEST_APP_PORT}`;

const startAppServer = async (
  env: Record<string, string | undefined> = process.env,
) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const appRoot = resolve(__dirname, "../..");

  const server = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(TEST_APP_PORT),
      "--strictPort",
    ],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        ...env,
        NODE_ENV: "test",
        MODE: "test",
      },
      stdio: "pipe",
    },
  );

  server.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[app-server] ${chunk}`);
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[app-server] ${chunk}`);
  });

  await waitForServer(`${TEST_APP_ORIGIN}/sign-up`, server);
  return server;
};

const stopAppServer = async (server?: ChildProcess) => {
  if (!server || server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await new Promise((resolveKill) => {
    const timer = setTimeout(resolveKill, 5_000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolveKill(undefined);
    });
  });
};

export {
  startAppServer,
  stopAppServer,
  TEST_APP_ORIGIN,
  TEST_APP_PORT,
  waitForServer,
};
