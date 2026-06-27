import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { incident } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { quote, toDateTime64 } from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import { getHostDetailInputSchema } from "../schema";
import {
  buildHostSeries,
  normalizeDateTime,
  toNullableNumber,
  toPercent,
} from "../shared";

const createGetHostDetail = ({
  db,
  clickhouse,
  logger,
}: {
  db: DB;
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getHostDetailInputSchema>,
  context: { appId: string },
) => {
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
      clickhouse.query({
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
      clickhouse.query({
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
      clickhouse.query({
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
      clickhouse.query({
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
      db.query.incident.findMany({
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
      (openIncident) =>
        openIncident.entityType === "host" && openIncident.entityId === hostId,
    );
    const containerIncidents = new Map(
      openIncidents
        .filter((openIncident) => openIncident.entityType === "container")
        .map((openIncident) => [openIncident.entityId, openIncident]),
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
        : new Date(normalizeDateTime(summaryRow.last_seen)).getTime() < staleCutoff
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
    recordError(error);
    logger.error("Failed to fetch host detail", error as Error);
    return err("Failed to fetch host detail.");
  }
};

export { createGetHostDetail };
