import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { agentInstallation } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { quote } from "../../shared/query-builders";
import { getHostInputSchema } from "../schema";
import { agentVersion, compareAgentVersions } from "../version";

const createGetHost =
  ({
    db,
    clickhouse,
    logger,
  }: {
    db: DB;
    clickhouse: ClickHouse;
    logger: Logger;
  }) =>
  async (
    input: z.input<typeof getHostInputSchema>,
    context: { appId: string },
  ) => {
    const validated = getHostInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const [installation] = await db
        .select()
        .from(agentInstallation)
        .where(
          and(
            eq(agentInstallation.id, validated.data.id),
            eq(agentInstallation.appId, context.appId),
            isNull(agentInstallation.revokedAt),
          ),
        )
        .limit(1);

      if (!installation) {
        return err("Host not found.");
      }

      const range = {
        "1h": { interval: "1 HOUR", bucket: "1 MINUTE" },
        "4h": { interval: "4 HOUR", bucket: "5 MINUTE" },
        "24h": { interval: "24 HOUR", bucket: "30 MINUTE" },
        "7d": { interval: "7 DAY", bucket: "2 HOUR" },
      }[validated.data.time];

      const [latestResult, seriesResult, diskSeriesResult, filesystemsResult] =
        await Promise.all([
          clickhouse.query({
            format: "JSONEachRow",
            query: `
            SELECT
              latest.host_name AS host_name,
              latest.host_arch AS host_arch,
              latest.os_type AS os_type,
              latest.reported_environment AS reported_environment,
              latest.agent_version AS agent_version,
              latest.last_seen AS last_seen,
              current.cpu_utilization AS cpu_utilization,
              current.memory_utilization AS memory_utilization,
              current.load_1m AS load_1m
            FROM (
              SELECT
                argMaxMerge(host_name) AS host_name,
                argMaxMerge(host_arch) AS host_arch,
                argMaxMerge(os_type) AS os_type,
                argMaxMerge(deployment_environment) AS reported_environment,
                argMaxMerge(agent_version) AS agent_version,
                max(last_seen) AS last_seen
              FROM host_metrics_latest
              WHERE app_id = ${quote(context.appId)}
                AND host_id = ${quote(installation.hostId)}
              HAVING last_seen >= now() - INTERVAL 7 DAY
            ) AS latest
            LEFT JOIN (
              SELECT
                greatest(0, least(1, 1 - avgIf(
                  coalesce(value_double, toFloat64(value_int)),
                  metric_name = 'system.cpu.utilization'
                    AND attributes['state'] = 'idle'
                ))) AS cpu_utilization,
                maxIf(
                  coalesce(value_double, toFloat64(value_int)),
                  metric_name = 'system.memory.utilization'
                    AND (attributes['state'] = '' OR attributes['state'] = 'used')
                ) AS memory_utilization,
                avgIf(
                  coalesce(value_double, toFloat64(value_int)),
                  metric_name = 'system.cpu.load_average.1m'
                ) AS load_1m
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND host_id = ${quote(installation.hostId)}
                AND entity_kind = 'host'
                AND time >= now() - INTERVAL 90 SECOND
            ) AS current ON 1
          `,
          }),
          clickhouse.query({
            format: "JSONEachRow",
            query: `
            SELECT
              toStartOfInterval(time, INTERVAL ${range.bucket}) AS bucket,
              greatest(0, least(1, 1 - avgIf(
                coalesce(value_double, toFloat64(value_int)),
                metric_name = 'system.cpu.utilization'
                  AND attributes['state'] = 'idle'
              ))) AS cpu_utilization,
              maxIf(
                coalesce(value_double, toFloat64(value_int)),
                metric_name = 'system.memory.utilization'
                  AND (attributes['state'] = '' OR attributes['state'] = 'used')
              ) AS memory_utilization,
              avgIf(
                coalesce(value_double, toFloat64(value_int)),
                metric_name = 'system.cpu.load_average.1m'
              ) AS load_1m
            FROM metrics_raw
            WHERE app_id = ${quote(context.appId)}
              AND host_id = ${quote(installation.hostId)}
              AND entity_kind = 'host'
              AND time >= now() - INTERVAL ${range.interval}
            GROUP BY bucket
            ORDER BY bucket ASC
          `,
          }),
          clickhouse.query({
            format: "JSONEachRow",
            query: `
            SELECT
              bucket,
              sum(used_bytes) AS disk_used_bytes,
              sum(used_bytes + free_bytes + reserved_bytes) AS disk_total_bytes
            FROM (
              SELECT
                toStartOfInterval(time, INTERVAL ${range.bucket}) AS bucket,
                attributes['device'] AS device,
                argMaxIf(
                  coalesce(value_double, toFloat64(value_int)),
                  time,
                  attributes['state'] = 'used'
                ) AS used_bytes,
                argMaxIf(
                  coalesce(value_double, toFloat64(value_int)),
                  time,
                  attributes['state'] = 'free'
                ) AS free_bytes,
                argMaxIf(
                  coalesce(value_double, toFloat64(value_int)),
                  time,
                  attributes['state'] = 'reserved'
                ) AS reserved_bytes
              FROM metrics_raw
              WHERE app_id = ${quote(context.appId)}
                AND host_id = ${quote(installation.hostId)}
                AND entity_kind = 'host'
                AND metric_name = 'system.filesystem.usage'
                AND attributes['mode'] = 'rw'
                AND attributes['device'] != ''
                AND time >= now() - INTERVAL ${range.interval}
              GROUP BY bucket, device
            )
            GROUP BY bucket
            ORDER BY bucket ASC
          `,
          }),
          clickhouse.query({
            format: "JSONEachRow",
            query: `
            SELECT
              attributes['device'] AS device,
              argMin(attributes['mountpoint'], length(attributes['mountpoint'])) AS mountpoint,
              argMax(attributes['type'], time) AS type,
              argMaxIf(
                coalesce(value_double, toFloat64(value_int)),
                time,
                attributes['state'] = 'used'
              ) AS used_bytes,
              argMaxIf(
                coalesce(value_double, toFloat64(value_int)),
                time,
                attributes['state'] = 'free'
              ) AS free_bytes,
              argMaxIf(
                coalesce(value_double, toFloat64(value_int)),
                time,
                attributes['state'] = 'reserved'
              ) AS reserved_bytes
            FROM metrics_raw
            WHERE app_id = ${quote(context.appId)}
              AND host_id = ${quote(installation.hostId)}
              AND entity_kind = 'host'
              AND metric_name = 'system.filesystem.usage'
              AND attributes['mode'] = 'rw'
              AND attributes['device'] != ''
              AND time >= now() - INTERVAL 90 SECOND
            GROUP BY device
            ORDER BY mountpoint ASC
          `,
          }),
        ]);

      const [latest] = (await latestResult.json()) as unknown as Array<{
        host_name: string;
        host_arch: string;
        os_type: string;
        reported_environment: string;
        agent_version: string;
        last_seen: string | null;
        cpu_utilization: number | string | null;
        memory_utilization: number | string | null;
        load_1m: number | string | null;
      }>;
      const series = (await seriesResult.json()) as unknown as Array<{
        bucket: string;
        cpu_utilization: number | string | null;
        memory_utilization: number | string | null;
        load_1m: number | string | null;
      }>;
      const diskSeries = (await diskSeriesResult.json()) as unknown as Array<{
        bucket: string;
        disk_used_bytes: number | string;
        disk_total_bytes: number | string;
      }>;
      const filesystems = (await filesystemsResult.json()) as unknown as Array<{
        device: string;
        mountpoint: string;
        type: string;
        used_bytes: number | string;
        free_bytes: number | string;
        reserved_bytes: number | string;
      }>;
      const lastSeen = latest?.last_seen
        ? new Date(latest.last_seen.replace(" ", "T") + "Z").toISOString()
        : null;
      const reporting =
        lastSeen !== null &&
        Date.now() - new Date(lastSeen).getTime() <= 120_000;
      const reportedAgentVersion = latest?.agent_version || null;
      const toNumber = (
        value: number | string | null | undefined,
        multiplier = 1,
        current = false,
      ) => {
        const number = Number(value);
        return (!current || reporting) &&
          value !== null &&
          Number.isFinite(number)
          ? number * multiplier
          : null;
      };
      const currentFilesystems = reporting
        ? filesystems.map((filesystem) => {
            const usedBytes = Number(filesystem.used_bytes);
            const freeBytes = Number(filesystem.free_bytes);
            const reservedBytes = Number(filesystem.reserved_bytes);
            const totalBytes = usedBytes + freeBytes + reservedBytes;

            return {
              device: filesystem.device,
              mountpoint: filesystem.mountpoint,
              type: filesystem.type,
              usedBytes,
              freeBytes,
              reservedBytes,
              totalBytes,
              utilization:
                totalBytes > 0 ? (usedBytes / totalBytes) * 100 : null,
            };
          })
        : [];
      const diskUsedBytes = currentFilesystems.reduce(
        (total, filesystem) => total + filesystem.usedBytes,
        0,
      );
      const diskTotalBytes = currentFilesystems.reduce(
        (total, filesystem) => total + filesystem.totalBytes,
        0,
      );

      return ok({
        host: {
          id: installation.id,
          displayName: installation.displayName || installation.hostName,
          environment:
            installation.environment ||
            latest?.reported_environment ||
            "production",
          hostId: installation.hostId,
          hostName: latest?.host_name || installation.hostName,
          reportedEnvironment: latest?.reported_environment || null,
          operatingSystem: latest?.os_type || installation.operatingSystem,
          architecture: latest?.host_arch || installation.architecture,
          agentVersion: reportedAgentVersion || installation.agentVersion,
          latestAgentVersion: agentVersion,
          updateAvailable:
            reportedAgentVersion !== null &&
            compareAgentVersions(reportedAgentVersion, agentVersion) < 0,
          installedAt: installation.createdAt,
          lastSeen,
          reporting,
          cpuUtilization: toNumber(latest?.cpu_utilization, 100, true),
          memoryUtilization: toNumber(latest?.memory_utilization, 100, true),
          diskUsedBytes: reporting ? diskUsedBytes : null,
          diskTotalBytes: reporting ? diskTotalBytes : null,
          load1m: toNumber(latest?.load_1m, 1, true),
        },
        series: series.map((point) => {
          const disk = diskSeries.find(
            (diskPoint) => diskPoint.bucket === point.bucket,
          );

          return {
            timestamp: new Date(
              point.bucket.replace(" ", "T") + "Z",
            ).toISOString(),
            cpuUtilization: toNumber(point.cpu_utilization, 100),
            memoryUtilization: toNumber(point.memory_utilization, 100),
            diskUsedBytes: toNumber(disk?.disk_used_bytes),
            diskTotalBytes: toNumber(disk?.disk_total_bytes),
            load1m: toNumber(point.load_1m),
          };
        }),
        filesystems: currentFilesystems,
        time: validated.data.time,
      });
    } catch (error) {
      recordError(error);
      logger.error("getHost: failed to get host", error as Error);
      return err("Failed to get host.");
    }
  };

export { createGetHost };
