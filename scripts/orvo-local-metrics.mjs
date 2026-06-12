#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const envFiles = [".env.local", ".env", "apps/app/.env.local", "apps/app/.env"];

for (const file of envFiles) {
  if (!existsSync(file)) continue;

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replaceAll("\\n", "\n");
  }
}

const args = new Set(process.argv.slice(2));
const endpoint = (
  process.env.ORVO_INGEST_ENDPOINT ??
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
  "https://ingest.orvo.sh"
).replace(/\/$/, "");
const ingestionKey =
  process.env.ORVO_INGESTION_KEY ??
  process.env.ORVO_PRIVATE_INGESTION_KEY ??
  process.env.INGESTION_KEY ??
  process.env.OTEL_EXPORTER_OTLP_HEADERS?.match(/(?:^|,)x-ingestion-key=([^,]+)/)?.[1];
const serviceName = process.env.ORVO_SERVICE_NAME ?? "local-workstation";
const environment = process.env.ORVO_DEPLOYMENT_ENVIRONMENT ?? "local";
const intervalMs = Number(process.env.ORVO_METRICS_INTERVAL_MS ?? 10_000);

if (!ingestionKey) {
  console.error(
    "Missing ingestion key. Set ORVO_INGESTION_KEY=sk_... before running this script.",
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeNumber = (read) => {
  try {
    const value = read();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const safeArray = (read) => {
  try {
    const value = read();
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const cpuSnapshot = () =>
  safeArray(() => os.cpus()).reduce(
    (acc, cpu) => {
      acc.user += cpu.times.user;
      acc.nice += cpu.times.nice;
      acc.system += cpu.times.sys;
      acc.idle += cpu.times.idle;
      acc.irq += cpu.times.irq;
      acc.total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
      return acc;
    },
    { user: 0, nice: 0, system: 0, idle: 0, irq: 0, total: 0 },
  );

const cpuUtilization = async () => {
  const start = cpuSnapshot();
  await sleep(750);
  const end = cpuSnapshot();
  const total = Math.max(end.total - start.total, 1);

  if (end.total === 0 || start.total === 0) {
    return null;
  }

  return {
    user: (end.user - start.user) / total,
    system: (end.system - start.system) / total,
    idle: (end.idle - start.idle) / total,
    nice: (end.nice - start.nice) / total,
    irq: (end.irq - start.irq) / total,
  };
};

const rootFilesystem = async () => {
  try {
    const { stdout } = await execFileAsync("/bin/df", ["-k", "/"]);
    const [, row] = stdout.trim().split("\n");
    const columns = row.trim().split(/\s+/);
    const total = Number(columns[1]) * 1024;
    const used = Number(columns[2]) * 1024;
    const available = Number(columns[3]) * 1024;

    return Number.isFinite(total) && total > 0
      ? { total, used, available, utilization: used / total }
      : null;
  } catch {
    return null;
  }
};

const attr = (key, value) => ({
  key,
  value: { stringValue: String(value) },
});

const point = (timeUnixNano, value, attributes = []) => ({
  timeUnixNano,
  asDouble: Number(value),
  attributes,
});

const gauge = (name, description, unit, dataPoints) => ({
  name,
  description,
  unit,
  gauge: {
    dataPoints,
  },
});

const buildPayload = async () => {
  const now = BigInt(Date.now()) * 1_000_000n;
  const timeUnixNano = now.toString();
  const loadAverage = safeArray(() => os.loadavg());
  const totalMemory = safeNumber(() => os.totalmem());
  const freeMemory = safeNumber(() => os.freemem());
  const uptime = safeNumber(() => os.uptime());
  const usedMemory = totalMemory - freeMemory;
  const cpu = await cpuUtilization();
  const filesystem = await rootFilesystem();

  const metrics = [];

  if (cpu) {
    metrics.push(
      gauge("system.cpu.utilization", "CPU utilization by state.", "1", [
      point(timeUnixNano, cpu.user, [attr("state", "user")]),
      point(timeUnixNano, cpu.system, [attr("state", "system")]),
      point(timeUnixNano, cpu.idle, [attr("state", "idle")]),
      point(timeUnixNano, cpu.nice, [attr("state", "nice")]),
      point(timeUnixNano, cpu.irq, [attr("state", "irq")]),
      ]),
    );
  }

  if (loadAverage.length >= 3) {
    metrics.push(
      gauge("system.cpu.load_average.1m", "One minute system load average.", "1", [
        point(timeUnixNano, loadAverage[0]),
      ]),
      gauge("system.cpu.load_average.5m", "Five minute system load average.", "1", [
        point(timeUnixNano, loadAverage[1]),
      ]),
      gauge("system.cpu.load_average.15m", "Fifteen minute system load average.", "1", [
        point(timeUnixNano, loadAverage[2]),
      ]),
    );
  }

  if (totalMemory !== null && freeMemory !== null && totalMemory > 0) {
    metrics.push(
      gauge("system.memory.usage", "Memory usage by state.", "By", [
        point(timeUnixNano, usedMemory, [attr("state", "used")]),
        point(timeUnixNano, freeMemory, [attr("state", "free")]),
      ]),
      gauge("system.memory.utilization", "Memory utilization.", "1", [
        point(timeUnixNano, usedMemory / totalMemory),
      ]),
    );
  }

  if (uptime !== null) {
    metrics.push(gauge("system.uptime", "System uptime.", "s", [point(timeUnixNano, uptime)]));
  }

  if (filesystem) {
    metrics.push(
      gauge("system.filesystem.usage", "Root filesystem usage by state.", "By", [
        point(timeUnixNano, filesystem.used, [attr("state", "used"), attr("mountpoint", "/")]),
        point(timeUnixNano, filesystem.available, [
          attr("state", "free"),
          attr("mountpoint", "/"),
        ]),
      ]),
      gauge("system.filesystem.utilization", "Root filesystem utilization.", "1", [
        point(timeUnixNano, filesystem.utilization, [attr("mountpoint", "/")]),
      ]),
    );
  }

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            attr("service.name", serviceName),
            attr("deployment.environment", environment),
            attr("os.type", os.type()),
            attr("os.platform", os.platform()),
            attr("telemetry.sdk.name", "orvo-local-metrics-script"),
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: "orvo.local.system",
              version: "1.0.0",
            },
            metrics,
          },
        ],
      },
    ],
  };
};

const sendOnce = async () => {
  const payload = await buildPayload();
  const response = await fetch(`${endpoint}/v1/metrics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ingestionKey}`,
      "Content-Type": "application/json",
      "x-ingestion-key": ingestionKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Orvo metrics ingest failed with ${response.status}: ${body}`);
  }

  console.log(
    `Sent ${payload.resourceMetrics[0].scopeMetrics[0].metrics.length} local metric groups to ${endpoint}/v1/metrics as ${serviceName}.`,
  );
};

if (args.has("--watch")) {
  console.log(`Sending local metrics every ${intervalMs}ms. Press Ctrl+C to stop.`);
  await sendOnce();
  setInterval(() => {
    sendOnce().catch((error) => {
      console.error(error.message);
    });
  }, intervalMs);
} else {
  await sendOnce();
}
