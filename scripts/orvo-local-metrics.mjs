#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const envFiles = ['.env.local', '.env', 'apps/app/.env.local', 'apps/app/.env'];

for (const file of envFiles) {
  if (!existsSync(file)) continue;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replaceAll('\\n', '\n');
  }
}

const args = new Set(process.argv.slice(2));
const endpoint = (
  process.env.ORVO_INGEST_ENDPOINT ??
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
  'http://localhost:4318'
).replace(/\/$/, '');
const ingestionKey =
  process.env.ORVO_INGESTION_KEY ??
  process.env.PROD_OTEL_INGEST_KEY ??
  process.env.ORVO_PRIVATE_INGESTION_KEY ??
  process.env.INGESTION_KEY ??
  process.env.OTEL_EXPORTER_OTLP_HEADERS?.match(/(?:^|,)x-ingestion-key=([^,]+)/)?.[1];
const serviceName = process.env.ORVO_SERVICE_NAME ?? 'local-workstation';
const environment = process.env.ORVO_DEPLOYMENT_ENVIRONMENT ?? 'local';
const hostName = process.env.ORVO_HOST_NAME ?? os.hostname();
const hostId = process.env.ORVO_HOST_ID ?? hostName;
const intervalMs = Math.max(Number(process.env.ORVO_METRICS_INTERVAL_MS ?? 5_000), 1_000);
const startTimeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
const dockerEnabled = process.env.ORVO_DOCKER_ENABLED !== 'false';

if (!ingestionKey) {
  console.error('Missing ingestion key. Set ORVO_INGESTION_KEY=sk_... before running this script.');
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

const safeObject = (read) => {
  try {
    const value = read();
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

const attr = (key, value) => ({
  key,
  value: { stringValue: String(value) }
});

const doublePoint = (timeUnixNano, value, attributes = []) => ({
  timeUnixNano,
  asDouble: Number(value),
  attributes
});

const intPoint = (timeUnixNano, value, attributes = []) => ({
  timeUnixNano,
  asInt: Math.trunc(Number(value)),
  attributes
});

const cumulativeDoublePoint = (timeUnixNano, value, attributes = []) => ({
  startTimeUnixNano,
  timeUnixNano,
  asDouble: Number(value),
  attributes
});

const gauge = (name, description, unit, dataPoints) => ({
  name,
  description,
  unit,
  gauge: {
    dataPoints
  }
});

const sumMetric = (name, description, unit, dataPoints, { monotonic = true, temporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE' } = {}) => ({
  name,
  description,
  unit,
  sum: {
    aggregationTemporality: temporality,
    isMonotonic: monotonic,
    dataPoints
  }
});

const resourceMetric = (attributes, metrics, scopeName) => ({
  resource: {
    attributes
  },
  scopeMetrics: [
    {
      scope: {
        name: scopeName,
        version: '2.0.0'
      },
      metrics
    }
  ]
});

const cpuSnapshot = () =>
  safeArray(() => os.cpus()).reduce(
    (acc, cpu) => {
      acc.user += cpu.times.user;
      acc.nice += cpu.times.nice;
      acc.system += cpu.times.sys;
      acc.idle += cpu.times.idle;
      acc.irq += cpu.times.irq;
      acc.total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      return acc;
    },
    { user: 0, nice: 0, system: 0, idle: 0, irq: 0, total: 0 }
  );

const rootFilesystem = async () => {
  try {
    const { stdout } = await execFileAsync('/bin/df', ['-k', '/']);
    const [, row] = stdout.trim().split('\n');

    if (!row) {
      return null;
    }

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

const metricState = {
  cpuTimeByStateSec: {
    user: 0,
    system: 0,
    idle: 0,
    nice: 0,
    irq: 0
  },
  processCpuTimeByStateSec: {
    user: 0,
    system: 0
  }
};

const parseSizedValue = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^([\d.]+)\s*([kmgtpe]?i?)?b?$/i);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = (match[2] ?? '').toLowerCase();
  const multipliers = {
    '': 1,
    k: 1_000,
    m: 1_000_000,
    g: 1_000_000_000,
    t: 1_000_000_000_000,
    p: 1_000_000_000_000_000,
    e: 1_000_000_000_000_000_000,
    ki: 1024,
    mi: 1024 ** 2,
    gi: 1024 ** 3,
    ti: 1024 ** 4,
    pi: 1024 ** 5,
    ei: 1024 ** 6
  };
  const multiplier = multipliers[unit];

  return multiplier ? amount * multiplier : null;
};

const parsePercent = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const number = Number(value.replace('%', '').trim());
  return Number.isFinite(number) ? number / 100 : null;
};

const collectDockerContainers = async () => {
  if (!dockerEnabled) {
    return [];
  }

  try {
    const [{ stdout: statsStdout }, { stdout: psStdout }] = await Promise.all([
      execFileAsync('docker', ['stats', '--no-stream', '--no-trunc', '--format', 'json']),
      execFileAsync('docker', ['ps', '--no-trunc', '--format', 'json'])
    ]);
    const imageByContainerId = new Map(
      psStdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            const row = JSON.parse(line);
            return [String(row.ID ?? '').trim(), String(row.Image ?? '').trim()];
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    );
    const lines = statsStdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return [];
    }

    return lines
      .map((line) => {
        try {
          const row = JSON.parse(line);
          const [memoryUsageRaw, memoryLimitRaw] = String(row.MemUsage ?? '')
            .split('/')
            .map((part) => part.trim());

          return {
            containerId: String(row.ID ?? '').trim(),
            containerName: String(row.Name ?? '').trim(),
            containerImageName: imageByContainerId.get(String(row.ID ?? '').trim()) ?? '',
            cpuUtilization: parsePercent(String(row.CPUPerc ?? '')),
            memoryUsageTotal: parseSizedValue(memoryUsageRaw),
            memoryUsageLimit: parseSizedValue(memoryLimitRaw)
          };
        } catch {
          return null;
        }
      })
      .filter((container) => container?.containerId);
  } catch {
    return [];
  }
};

const collectSnapshot = async () => {
  const [filesystem, dockerContainers] = await Promise.all([rootFilesystem(), collectDockerContainers()]);
  const now = new Date();
  const cpuTimes = cpuSnapshot();
  const loadAverage = safeArray(() => os.loadavg());
  const totalMemory = safeNumber(() => os.totalmem());
  const freeMemory = safeNumber(() => os.freemem());
  const uptime = safeNumber(() => os.uptime());
  const processMemory = safeObject(() => process.memoryUsage());
  const processCpuUsage = safeObject(() => process.cpuUsage());
  const cpus = safeArray(() => os.cpus());

  return {
    now,
    cpuTimes,
    loadAverage,
    filesystem,
    totalMemory,
    freeMemory,
    uptime,
    processMemory,
    processCpuUsage,
    cpuCount: cpus.length,
    dockerContainers
  };
};

const deriveCpuUtilization = async () => {
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
    irq: (end.irq - start.irq) / total
  };
};

const updateState = (snapshot) => {
  metricState.cpuTimeByStateSec.user = snapshot.cpuTimes.user / 1_000;
  metricState.cpuTimeByStateSec.system = snapshot.cpuTimes.system / 1_000;
  metricState.cpuTimeByStateSec.idle = snapshot.cpuTimes.idle / 1_000;
  metricState.cpuTimeByStateSec.nice = snapshot.cpuTimes.nice / 1_000;
  metricState.cpuTimeByStateSec.irq = snapshot.cpuTimes.irq / 1_000;

  metricState.processCpuTimeByStateSec.user =
    Number(snapshot.processCpuUsage?.user ?? 0) / 1_000_000;
  metricState.processCpuTimeByStateSec.system =
    Number(snapshot.processCpuUsage?.system ?? 0) / 1_000_000;
};

const buildPayload = async () => {
  const [snapshot, cpuUtilization] = await Promise.all([collectSnapshot(), deriveCpuUtilization()]);
  updateState(snapshot);

  const nowUnixNano = (BigInt(snapshot.now.getTime()) * 1_000_000n).toString();
  const hostMetrics = [];
  const totalMemory = snapshot.totalMemory;
  const freeMemory = snapshot.freeMemory;
  const usedMemory =
    totalMemory !== null && freeMemory !== null ? totalMemory - freeMemory : null;

  if (cpuUtilization) {
    hostMetrics.push(
      gauge('system.cpu.utilization', 'CPU utilization by state.', '1', [
        doublePoint(nowUnixNano, cpuUtilization.user, [attr('state', 'user')]),
        doublePoint(nowUnixNano, cpuUtilization.system, [attr('state', 'system')]),
        doublePoint(nowUnixNano, cpuUtilization.idle, [attr('state', 'idle')]),
        doublePoint(nowUnixNano, cpuUtilization.nice, [attr('state', 'nice')]),
        doublePoint(nowUnixNano, cpuUtilization.irq, [attr('state', 'irq')])
      ]),
      sumMetric('system.cpu.time', 'CPU time by state.', 's', [
        cumulativeDoublePoint(nowUnixNano, metricState.cpuTimeByStateSec.user, [attr('state', 'user')]),
        cumulativeDoublePoint(nowUnixNano, metricState.cpuTimeByStateSec.system, [attr('state', 'system')]),
        cumulativeDoublePoint(nowUnixNano, metricState.cpuTimeByStateSec.idle, [attr('state', 'idle')]),
        cumulativeDoublePoint(nowUnixNano, metricState.cpuTimeByStateSec.nice, [attr('state', 'nice')]),
        cumulativeDoublePoint(nowUnixNano, metricState.cpuTimeByStateSec.irq, [attr('state', 'irq')])
      ])
    );
  }

  if (snapshot.loadAverage.length >= 3) {
    hostMetrics.push(
      gauge('system.cpu.load_average.1m', 'One minute system load average.', '1', [
        doublePoint(nowUnixNano, snapshot.loadAverage[0])
      ]),
      gauge('system.cpu.load_average.5m', 'Five minute system load average.', '1', [
        doublePoint(nowUnixNano, snapshot.loadAverage[1])
      ]),
      gauge('system.cpu.load_average.15m', 'Fifteen minute system load average.', '1', [
        doublePoint(nowUnixNano, snapshot.loadAverage[2])
      ])
    );
  }

  if (totalMemory !== null && freeMemory !== null && totalMemory > 0 && usedMemory !== null) {
    hostMetrics.push(
      gauge('system.memory.usage', 'Memory usage by state.', 'By', [
        doublePoint(nowUnixNano, usedMemory, [attr('state', 'used')]),
        doublePoint(nowUnixNano, freeMemory, [attr('state', 'free')])
      ]),
      gauge('system.memory.utilization', 'Memory utilization.', '1', [
        doublePoint(nowUnixNano, usedMemory / totalMemory)
      ])
    );
  }

  if (snapshot.uptime !== null) {
    hostMetrics.push(gauge('system.uptime', 'System uptime.', 's', [doublePoint(nowUnixNano, snapshot.uptime)]));
  }

  if (snapshot.cpuCount > 0) {
    hostMetrics.push(gauge('system.cpu.logical.count', 'Logical CPU count.', '{cpu}', [intPoint(nowUnixNano, snapshot.cpuCount)]));
  }

  if (snapshot.filesystem) {
    hostMetrics.push(
      gauge('system.filesystem.usage', 'Root filesystem usage by state.', 'By', [
        doublePoint(nowUnixNano, snapshot.filesystem.used, [attr('state', 'used'), attr('mountpoint', '/')]),
        doublePoint(nowUnixNano, snapshot.filesystem.available, [attr('state', 'free'), attr('mountpoint', '/')]),
        doublePoint(nowUnixNano, snapshot.filesystem.total, [attr('state', 'total'), attr('mountpoint', '/')])
      ]),
      gauge('system.filesystem.utilization', 'Root filesystem utilization.', '1', [
        doublePoint(nowUnixNano, snapshot.filesystem.utilization, [attr('mountpoint', '/')])
      ])
    );
  }

  if (snapshot.processMemory) {
    const heapUtilization =
      snapshot.processMemory.heapTotal > 0
        ? snapshot.processMemory.heapUsed / snapshot.processMemory.heapTotal
        : null;

    hostMetrics.push(
      gauge('process.memory.usage', 'Current process memory usage.', 'By', [
        doublePoint(nowUnixNano, snapshot.processMemory.rss, [attr('state', 'rss')]),
        doublePoint(nowUnixNano, snapshot.processMemory.heapTotal, [attr('state', 'heap_total')]),
        doublePoint(nowUnixNano, snapshot.processMemory.heapUsed, [attr('state', 'heap_used')]),
        doublePoint(nowUnixNano, snapshot.processMemory.external, [attr('state', 'external')]),
        doublePoint(nowUnixNano, snapshot.processMemory.arrayBuffers ?? 0, [attr('state', 'array_buffers')])
      ])
    );

    if (heapUtilization !== null) {
      hostMetrics.push(
        gauge('process.runtime.nodejs.memory.heap.utilization', 'Current process heap utilization.', '1', [
          doublePoint(nowUnixNano, heapUtilization)
        ])
      );
    }
  }

  hostMetrics.push(
    sumMetric('process.cpu.time', 'Current process CPU time by state.', 's', [
      cumulativeDoublePoint(nowUnixNano, metricState.processCpuTimeByStateSec.user, [attr('state', 'user')]),
      cumulativeDoublePoint(nowUnixNano, metricState.processCpuTimeByStateSec.system, [attr('state', 'system')])
    ])
  );

  const baseResourceAttributes = [
    attr('service.name', serviceName),
    attr('deployment.environment', environment),
    attr('host.id', hostId),
    attr('host.name', hostName),
    attr('host.arch', os.arch()),
    attr('os.type', os.type()),
    attr('os.platform', os.platform()),
    attr('process.runtime.name', 'node'),
    attr('telemetry.sdk.name', 'orvo-local-metrics-script')
  ];

  const resourceMetrics = [
    resourceMetric(baseResourceAttributes, hostMetrics, 'orvo.local.host')
  ];

  for (const container of snapshot.dockerContainers) {
    const containerMetrics = [];

    if (container.cpuUtilization !== null) {
      containerMetrics.push(
        gauge('container.cpu.utilization', 'Container CPU utilization.', '1', [
          doublePoint(nowUnixNano, container.cpuUtilization)
        ])
      );
    }

    if (container.memoryUsageTotal !== null) {
      containerMetrics.push(
        gauge('container.memory.usage.total', 'Container memory usage.', 'By', [
          intPoint(nowUnixNano, container.memoryUsageTotal)
        ])
      );
    }

    if (container.memoryUsageLimit !== null) {
      containerMetrics.push(
        gauge('container.memory.usage.limit', 'Container memory limit.', 'By', [
          intPoint(nowUnixNano, container.memoryUsageLimit)
        ])
      );
    }

    if (containerMetrics.length === 0) {
      continue;
    }

    resourceMetrics.push(
      resourceMetric(
        [
          ...baseResourceAttributes,
          attr('container.id', container.containerId),
          attr('container.name', container.containerName),
          attr('container.image.name', container.containerImageName)
        ],
        containerMetrics,
        'orvo.local.docker'
      )
    );
  }

  return {
    resourceMetrics
  };
};

const sendOnce = async () => {
  const payload = await buildPayload();
  const response = await fetch(`${endpoint}/v1/metrics`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ingestionKey}`,
      'Content-Type': 'application/json',
      'x-ingestion-key': ingestionKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Orvo metrics ingest failed with ${response.status}: ${body}`);
  }

  console.log(
    `[${new Date().toISOString()}] Sent ${payload.resourceMetrics.reduce((count, item) => count + item.scopeMetrics[0].metrics.length, 0)} metric groups across ${payload.resourceMetrics.length} resources to ${endpoint}/v1/metrics as ${serviceName} every ${intervalMs}ms.`
  );
};

const runContinuously = async () => {
  console.log(`Sending local metrics every ${intervalMs}ms. Press Ctrl+C to stop.`);

  while (true) {
    const cycleStartedAt = Date.now();

    try {
      await sendOnce();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }

    const remainingMs = Math.max(intervalMs - (Date.now() - cycleStartedAt), 0);
    await sleep(remainingMs);
  }
};

if (args.has('--once')) {
  await sendOnce();
} else {
  await runContinuously();
}
