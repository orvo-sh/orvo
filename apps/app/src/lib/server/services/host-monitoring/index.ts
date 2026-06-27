import { Instrument } from "$lib/instrumentation";
import { readFile } from "node:fs/promises";

import {
  assetPaths,
  installerPublishPath,
  renderInstallBundle,
  templatePaths,
} from "@repo/host-agent";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { incident, ingestionKey } from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { IncidentService } from "../incident";
import type { IngestionKeyService } from "../ingestion-key";
import { quote, toDateTime64 } from "../shared/query-builders";
import { resolveTimeFilter, timeFilterSchema } from "../shared/time-filter";

@Instrument({ prefix: "hostMonitoring" })
class HostMonitoringService {
  private logger: Logger;

  constructor(
    private db: DB,
    private clickhouse: ClickHouse,
    private encryption: Encryption,
    logger: Logger,
    private incidentService: IncidentService,
    private ingestionKeyService: IngestionKeyService,
    private config: {
      appBaseUrl: string;
      cdnBaseUrl: string;
      otlpBaseUrl: string;
    },
  ) {
    this.logger = logger.child("HostMonitoringService");
  }

  async createInstallSession(
    input: z.input<typeof createHostInstallSessionInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("createInstallSession: creating host install session", {
      input,
      context,
    });

    const validated = createHostInstallSessionInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      let privateKey = await this.getPrivateIngestionKey(context.appId);
      if (!privateKey) {
        const keyResult = await this.ingestionKeyService.createIngestionKey(
          { kind: "private" },
          context,
        );
        if (!keyResult.success) {
          return err(keyResult.error);
        }
        privateKey = keyResult.data.key;
      }

      const expiresAt = new Date(Date.now() + 15 * 60_000);
      const token = this.encryption.encrypt(
        JSON.stringify({
          appId: context.appId,
          dockerEnabled: validated.data.dockerEnabled,
          expiresAt: expiresAt.toISOString(),
        }),
      );
      const bundleUrl = new URL(
        `/api/host-monitoring/install-bundles/${encodeURIComponent(token)}`,
        this.config.appBaseUrl,
      ).toString();
      const installerUrl = new URL(
        installerPublishPath,
        this.config.cdnBaseUrl,
      ).toString();

      return ok({
        bundleUrl,
        installerUrl,
        expiresAt: expiresAt.toISOString(),
        command: `curl -fsSL ${shellQuote(installerUrl)} | sudo bash -s -- --bundle-url ${shellQuote(bundleUrl)}`,
        dockerEnabled: validated.data.dockerEnabled,
        installScriptSourcePath: assetPaths.installer,
      });
    } catch (error) {
      this.logger.error(
        "createInstallSession: failed to create install session",
        error as Error,
      );
      return err("Failed to create install session.");
    }
  }

  async getInstallBundle(
    input: z.input<typeof getHostInstallBundleInputSchema>,
  ) {
    this.logger.info("getInstallBundle: rendering install bundle");

    const validated = getHostInstallBundleInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const payload = JSON.parse(
        this.encryption.decrypt(validated.data.token),
      ) as {
        appId: string;
        dockerEnabled: boolean;
        expiresAt: string;
      };
      if (
        !payload.appId ||
        typeof payload.dockerEnabled !== "boolean" ||
        !payload.expiresAt
      ) {
        return err("Invalid install token.");
      }

      if (new Date(payload.expiresAt).getTime() < Date.now()) {
        return err("Install token has expired.");
      }

      const privateKey = await this.getPrivateIngestionKey(payload.appId);
      if (!privateKey) {
        return err("Private ingestion key is missing for this app.");
      }

      const [collectorConfig, systemdUnit, envFile] = await Promise.all([
        readFile(templatePaths.collectorConfig, "utf8"),
        readFile(templatePaths.systemdUnit, "utf8"),
        readFile(templatePaths.envFile, "utf8"),
      ]);

      return ok({
        content: renderInstallBundle(
          {
            collectorConfig,
            systemdUnit,
            envFile,
          },
          {
            appId: payload.appId,
            dockerEnabled: payload.dockerEnabled,
            otlpEndpoint: this.config.otlpBaseUrl,
            privateIngestionKey: privateKey,
          },
        ),
        contentType: "text/plain; charset=utf-8",
      });
    } catch (error) {
      this.logger.error(
        "getInstallBundle: failed to render install bundle",
        error as Error,
      );
      return err("Failed to render install bundle.");
    }
  }

  async getHosts(
    input: z.input<typeof getHostsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getHosts: listing hosts", { input, context });

    const validated = getHostsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const hostResult = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            host_id,
            argMax(host_name, time) AS host_name,
            argMax(host_arch, time) AS host_arch,
            argMax(os_type, time) AS os_type,
            max(time) AS last_seen,
            argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.cpu.utilization') AS cpu_utilization,
            argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.memory.utilization') AS memory_utilization,
            argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.filesystem.utilization') AS filesystem_utilization,
            argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.cpu.load_average.1m') AS load_1m
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND entity_kind = 'host'
            AND host_id != ''
            AND time >= ${toDateTime64(timeRange.startAtUtc)}
            AND time <= ${toDateTime64(timeRange.endAtUtc)}
          GROUP BY host_id
          ORDER BY last_seen DESC
        `,
      });
      const containerResult = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            host_id,
            uniqExactIf(container_id, container_id != '') AS container_count
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND entity_kind = 'container'
            AND host_id != ''
            AND time >= ${toDateTime64(timeRange.startAtUtc)}
            AND time <= ${toDateTime64(timeRange.endAtUtc)}
          GROUP BY host_id
        `,
      });
      const [hostRows, containerRows, openIncidents] = await Promise.all([
        hostResult.json() as Promise<
          Array<{
            host_id: string;
            host_name: string;
            host_arch: string;
            os_type: string;
            last_seen: string;
            cpu_utilization: number | string | null;
            memory_utilization: number | string | null;
            filesystem_utilization: number | string | null;
            load_1m: number | string | null;
          }>
        >,
        containerResult.json() as Promise<
          Array<{
            host_id: string;
            container_count: number | string;
          }>
        >,
        this.db.query.incident.findMany({
          where: and(
            eq(incident.appId, context.appId),
            eq(incident.status, "open"),
          ),
          orderBy: [desc(incident.openedAt)],
        }),
      ]);

      const containerCounts = new Map(
        containerRows.map((row) => [row.host_id, Number(row.container_count)]),
      );
      const hostIncidents = new Map(
        openIncidents
          .filter((incident) => incident.entityType === "host")
          .map((incident) => [incident.entityId, incident]),
      );
      const staleCutoff = Date.now() - 2 * 60_000;

      const hosts = hostRows
        .filter((row) => {
          if (!validated.data.search) {
            return true;
          }

          return [row.host_name, row.host_id]
            .join(" ")
            .toLowerCase()
            .includes(validated.data.search.toLowerCase());
        })
        .map((row) => {
          const lastSeen = normalizeDateTime(row.last_seen);
          const openIncident = hostIncidents.get(row.host_id) ?? null;
          let status: "healthy" | "stale" | "alerting" = "healthy";

          if (openIncident) {
            status = "alerting";
          } else if (new Date(lastSeen).getTime() < staleCutoff) {
            status = "stale";
          }

          return {
            hostId: row.host_id,
            hostName: row.host_name || row.host_id,
            hostArch: row.host_arch || null,
            osType: row.os_type || null,
            lastSeen,
            status,
            cpuUtilization: toPercent(row.cpu_utilization),
            memoryUtilization: toPercent(row.memory_utilization),
            filesystemUtilization: toPercent(row.filesystem_utilization),
            load1m: toNullableNumber(row.load_1m),
            containerCount: containerCounts.get(row.host_id) ?? 0,
            openIncident,
          };
        });

      const summary = {
        totalHosts: hosts.length,
        healthyHosts: hosts.filter((host) => host.status === "healthy").length,
        staleHosts: hosts.filter((host) => host.status === "stale").length,
        alertingHosts: hosts.filter((host) => host.status === "alerting")
          .length,
        reportingContainers: hosts.reduce(
          (count, host) => count + host.containerCount,
          0,
        ),
      };

      return ok({ hosts, summary });
    } catch (error) {
      this.logger.error("getHosts: failed to list hosts", error as Error);
      return err("Failed to fetch hosts.");
    }
  }

  async getHostDetail(
    input: z.input<typeof getHostDetailInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getHostDetail: fetching host detail", { input, context });

    const validated = getHostDetailInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const hostId = validated.data.hostId;

      const [
        summaryResult,
        seriesResult,
        containerResult,
        filesystemResult,
        openIncidents,
      ] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
              SELECT
                host_id,
                argMax(host_name, time) AS host_name,
                argMax(host_arch, time) AS host_arch,
                argMax(os_type, time) AS os_type,
                max(time) AS last_seen,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.cpu.utilization') AS cpu_utilization,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.memory.utilization') AS memory_utilization,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.filesystem.utilization') AS filesystem_utilization,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.cpu.load_average.1m') AS load_1m
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND entity_kind = 'host'
                AND host_id = ${quote(hostId)}
                AND time >= ${toDateTime64(timeRange.startAtUtc)}
                AND time <= ${toDateTime64(timeRange.endAtUtc)}
              GROUP BY host_id
            `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
              WITH
                ${timeRange.startAtUtc.getTime()} AS start_ms,
                ${bucketSizeMs} AS bucket_ms
              SELECT
                metric_name,
                least(toInt32(intDiv(toUnixTimestamp64Milli(time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
                avg(coalesce(value_double, toFloat64(value_int))) AS value
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND entity_kind = 'host'
                AND host_id = ${quote(hostId)}
                AND metric_name IN ('system.cpu.utilization', 'system.memory.utilization', 'system.filesystem.utilization')
                AND time >= ${toDateTime64(timeRange.startAtUtc)}
                AND time <= ${toDateTime64(timeRange.endAtUtc)}
              GROUP BY metric_name, bucket_index
              ORDER BY metric_name ASC, bucket_index ASC
            `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
              SELECT
                container_id,
                argMax(container_name, time) AS container_name,
                argMax(container_image_name, time) AS container_image_name,
                max(time) AS last_seen,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'container.cpu.utilization') AS cpu_utilization,
                argMaxIf(toFloat64(value_int), time, metric_name = 'container.memory.usage.total') AS memory_usage_total,
                argMaxIf(toFloat64(value_int), time, metric_name = 'container.memory.usage.limit') AS memory_usage_limit
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND entity_kind = 'container'
                AND host_id = ${quote(hostId)}
                AND container_id != ''
                AND time >= ${toDateTime64(timeRange.startAtUtc)}
                AND time <= ${toDateTime64(timeRange.endAtUtc)}
              GROUP BY container_id
              ORDER BY last_seen DESC
            `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
              SELECT
                attributes['mountpoint'] AS mountpoint,
                argMaxIf(coalesce(value_double, toFloat64(value_int)), time, metric_name = 'system.filesystem.utilization') AS utilization
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND entity_kind = 'host'
                AND host_id = ${quote(hostId)}
                AND metric_name = 'system.filesystem.utilization'
                AND time >= ${toDateTime64(timeRange.startAtUtc)}
                AND time <= ${toDateTime64(timeRange.endAtUtc)}
              GROUP BY mountpoint
              ORDER BY utilization DESC
              LIMIT 10
            `,
        }),
        this.db.query.incident.findMany({
          where: and(
            eq(incident.appId, context.appId),
            eq(incident.status, "open"),
          ),
          orderBy: [desc(incident.openedAt)],
        }),
      ]);

      const [summaryRows, seriesRows, containerRows, filesystemRows] =
        await Promise.all([
          summaryResult.json() as Promise<
            Array<{
              host_id: string;
              host_name: string;
              host_arch: string;
              os_type: string;
              last_seen: string;
              cpu_utilization: number | string | null;
              memory_utilization: number | string | null;
              filesystem_utilization: number | string | null;
              load_1m: number | string | null;
            }>
          >,
          seriesResult.json() as Promise<
            Array<{
              metric_name: string;
              bucket_index: number;
              value: number | string | null;
            }>
          >,
          containerResult.json() as Promise<
            Array<{
              container_id: string;
              container_name: string;
              container_image_name: string;
              last_seen: string;
              cpu_utilization: number | string | null;
              memory_usage_total: number | string | null;
              memory_usage_limit: number | string | null;
            }>
          >,
          filesystemResult.json() as Promise<
            Array<{
              mountpoint: string;
              utilization: number | string | null;
            }>
          >,
        ]);

      const summaryRow = summaryRows[0];
      if (!summaryRow) {
        return err("Host not found.");
      }

      const hostIncident = openIncidents.find(
        (incident) =>
          incident.entityType === "host" && incident.entityId === hostId,
      );
      const containerIncidents = new Map(
        openIncidents
          .filter((incident) => incident.entityType === "container")
          .map((incident) => [incident.entityId, incident]),
      );
      const staleCutoff = Date.now() - 2 * 60_000;

      const host = {
        hostId,
        hostName: summaryRow.host_name || hostId,
        hostArch: summaryRow.host_arch || null,
        osType: summaryRow.os_type || null,
        lastSeen: normalizeDateTime(summaryRow.last_seen),
        status: hostIncident
          ? "alerting"
          : new Date(normalizeDateTime(summaryRow.last_seen)).getTime() <
              staleCutoff
            ? "stale"
            : "healthy",
        cpuUtilization: toPercent(summaryRow.cpu_utilization),
        memoryUtilization: toPercent(summaryRow.memory_utilization),
        filesystemUtilization: toPercent(summaryRow.filesystem_utilization),
        load1m: toNullableNumber(summaryRow.load_1m),
        openIncident: hostIncident ?? null,
      } as const;

      const containers = containerRows.map((row) => {
        const lastSeen = normalizeDateTime(row.last_seen);
        const memoryUsageBytes = toNullableNumber(row.memory_usage_total);
        const memoryLimitBytes = toNullableNumber(row.memory_usage_limit);
        const memoryUtilization =
          memoryUsageBytes !== null &&
          memoryLimitBytes !== null &&
          memoryLimitBytes > 0
            ? (memoryUsageBytes / memoryLimitBytes) * 100
            : null;
        const openIncident = containerIncidents.get(row.container_id) ?? null;

        return {
          containerId: row.container_id,
          containerName: row.container_name || row.container_id,
          containerImageName: row.container_image_name || null,
          lastSeen,
          status: openIncident
            ? "alerting"
            : new Date(lastSeen).getTime() < staleCutoff
              ? "stale"
              : "healthy",
          cpuUtilization: toPercent(row.cpu_utilization),
          memoryUsageBytes,
          memoryLimitBytes,
          memoryUtilization,
          openIncident,
        };
      });

      return ok({
        host,
        series: buildHostSeries(
          seriesRows,
          timeRange.startAtUtc,
          timeRange.endAtUtc,
          bucketCount,
          bucketSizeMs,
        ),
        containers,
        filesystems: filesystemRows.map((row) => ({
          mountpoint: row.mountpoint || "unknown",
          utilization: toPercent(row.utilization),
        })),
      });
    } catch (error) {
      this.logger.error(
        "getHostDetail: failed to fetch host detail",
        error as Error,
      );
      return err("Failed to fetch host detail.");
    }
  }

  async evaluateHostIncidents() {
    this.logger.info("evaluateHostIncidents: evaluating built-in host incidents");

    try {
      const now = new Date();
      const discoveryStartAt = new Date(now.getTime() - 24 * 60 * 60_000);
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            app_id,
            host_id,
            argMax(host_name, time) AS host_name,
            max(time) AS last_seen
          FROM metrics_raw
          WHERE entity_kind = 'host'
            AND host_id != ''
            AND time >= ${toDateTime64(discoveryStartAt)}
            AND time <= ${toDateTime64(now)}
          GROUP BY app_id, host_id
        `,
      });
      const rows = (await result.json()) as Array<{
        app_id: string;
        host_id: string;
        host_name: string;
        last_seen: string;
      }>;

      let opened = 0;
      let resolved = 0;

      for (const row of rows) {
        const lastSeenAt = new Date(normalizeDateTime(row.last_seen));
        const ageMs = now.getTime() - lastSeenAt.getTime();
        const agentDisconnectedKey = buildHostIncidentSourceKey(
          row.host_id,
          "agent_disconnected",
        );
        const offlineKey = buildHostIncidentSourceKey(row.host_id, "offline");

        if (ageMs > 10 * 60_000) {
          if (
            await this.incidentService.resolveOpenIncidentBySourceKey({
              appId: row.app_id,
              sourceKey: agentDisconnectedKey,
              now,
              metadata: {
                reason: "host_offline_escalated",
              },
            })
          ) {
            resolved += 1;
          }

          const openedIncident = await this.incidentService.openOrGetIncident({
            appId: row.app_id,
            sourceType: "host",
            sourceId: row.host_id,
            sourceKey: offlineKey,
            type: "host_offline",
            title: "Host offline",
            severity: "critical",
            entityType: "host",
            entityId: row.host_id,
            entityName: row.host_name || row.host_id,
            sourceSnapshot: {
              hostId: row.host_id,
              hostName: row.host_name || row.host_id,
              lastSeenAt: lastSeenAt.toISOString(),
              incidentKind: "offline",
            },
            triggerEventType: "host.offline",
            now,
            lastObservedAt: now,
            triggerMetadata: {
              lastSeenAt: lastSeenAt.toISOString(),
            },
          });

          if (openedIncident.opened) {
            opened += 1;
          }

          continue;
        }

        if (ageMs > 2 * 60_000) {
          if (
            await this.incidentService.resolveOpenIncidentBySourceKey({
              appId: row.app_id,
              sourceKey: offlineKey,
              now,
              metadata: {
                reason: "host_back_within_offline_threshold",
              },
            })
          ) {
            resolved += 1;
          }

          const openedIncident = await this.incidentService.openOrGetIncident({
            appId: row.app_id,
            sourceType: "host",
            sourceId: row.host_id,
            sourceKey: agentDisconnectedKey,
            type: "host_agent_disconnected",
            title: "Host agent disconnected",
            severity: "warning",
            entityType: "host",
            entityId: row.host_id,
            entityName: row.host_name || row.host_id,
            sourceSnapshot: {
              hostId: row.host_id,
              hostName: row.host_name || row.host_id,
              lastSeenAt: lastSeenAt.toISOString(),
              incidentKind: "agent_disconnected",
            },
            triggerEventType: "host.agent_disconnected",
            now,
            lastObservedAt: now,
            triggerMetadata: {
              lastSeenAt: lastSeenAt.toISOString(),
            },
          });

          if (openedIncident.opened) {
            opened += 1;
          }

          continue;
        }

        const agentRecovered = await this.incidentService.recoverSourceIncident({
          appId: row.app_id,
          sourceKey: agentDisconnectedKey,
          now,
          eventType: "host.recovered",
          eventMetadata: {
            hostId: row.host_id,
          },
        });
        const offlineRecovered = await this.incidentService.recoverSourceIncident({
          appId: row.app_id,
          sourceKey: offlineKey,
          now,
          eventType: "host.recovered",
          eventMetadata: {
            hostId: row.host_id,
          },
        });

        if (agentRecovered.mode === "resolved_open") {
          resolved += 1;
        }
        if (offlineRecovered.mode === "resolved_open") {
          resolved += 1;
        }
      }

      return ok({ opened, resolved });
    } catch (error) {
      this.logger.error(
        "evaluateHostIncidents: failed to evaluate host incidents",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to evaluate host incidents.");
    }
  }

  private async getPrivateIngestionKey(appId: string) {
    const key = await this.db.query.ingestionKey.findFirst({
      where: and(
        eq(ingestionKey.appId, appId),
        eq(ingestionKey.kind, "private"),
        isNull(ingestionKey.revokedAt),
      ),
      orderBy: [desc(ingestionKey.createdAt)],
    });

    return key?.key ?? null;
  }
}

const createHostInstallSessionInputSchema = z.object({
  dockerEnabled: z.boolean().default(false),
});

const getHostInstallBundleInputSchema = z.object({
  token: z.string().trim().min(1),
});

const getHostsInputSchema = z.object({
  time: timeFilterSchema.default({
    kind: "preset",
    preset: "last_24_hours",
  }),
  search: z.string().trim().max(200).default(""),
});

const getHostDetailInputSchema = z.object({
  hostId: z.string().trim().min(1),
  time: timeFilterSchema.default({
    kind: "preset",
    preset: "last_hour",
  }),
  bucketCount: z.number().int().min(10).max(120).default(48),
});

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toPercent = (value: number | string | null | undefined) => {
  const number = toNullableNumber(value);
  if (number === null) {
    return null;
  }

  return number * 100;
};

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.includes("T") && !value.endsWith("Z") ? `${value}Z` : value;
};

const buildHostSeries = (
  rows: Array<{
    metric_name: string;
    bucket_index: number;
    value: number | string | null;
  }>,
  startAtUtc: Date,
  endAtUtc: Date,
  bucketCount: number,
  bucketSizeMs: number,
) => {
  const metricNames = [
    "system.cpu.utilization",
    "system.memory.utilization",
    "system.filesystem.utilization",
  ] as const;
  const labels: Record<(typeof metricNames)[number], string> = {
    "system.cpu.utilization": "CPU",
    "system.memory.utilization": "Memory",
    "system.filesystem.utilization": "Filesystem",
  };
  const rowMap = new Map(
    rows.map((row) => [`${row.metric_name}:${row.bucket_index}`, row]),
  );

  return metricNames.map((metricName) => {
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(startAtUtc.getTime() + index * bucketSizeMs);
      const bucketEnd = new Date(
        Math.min(
          startAtUtc.getTime() + (index + 1) * bucketSizeMs,
          endAtUtc.getTime(),
        ),
      );
      const row = rowMap.get(`${metricName}:${index}`);

      return {
        startAtUtc: bucketStart.toISOString(),
        endAtUtc: bucketEnd.toISOString(),
        value: toPercent(row?.value ?? null),
        points: row ? 1 : 0,
      };
    });

    return {
      key: metricName,
      label: labels[metricName],
      points: buckets.filter((bucket) => bucket.points > 0).length,
      buckets,
    };
  });
};

const shellQuote = (value: string) => `'${value.replaceAll(`'`, `'\"'\"'`)}'`;
const buildHostIncidentSourceKey = (
  hostId: string,
  type: "agent_disconnected" | "offline",
) => `host:${hostId}:${type}`;

export {
  createHostInstallSessionInputSchema,
  getHostDetailInputSchema,
  getHostInstallBundleInputSchema,
  getHostsInputSchema,
  HostMonitoringService,
};
