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
import { getHostsInputSchema } from "../schema";
import { normalizeDateTime, toNullableNumber, toPercent } from "../shared";

const createGetHosts = ({
  db,
  clickhouse,
  logger,
}: {
  db: DB;
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getHostsInputSchema>,
  context: { appId: string },
) => {
  const validated = getHostsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const timeRange = resolveTimeFilter(validated.data.time);
    const hostResult = await clickhouse.query({
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
    const containerResult = await clickhouse.query({
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
      db.query.incident.findMany({
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
        .filter((openIncident) => openIncident.entityType === "host")
        .map((openIncident) => [openIncident.entityId, openIncident]),
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
      alertingHosts: hosts.filter((host) => host.status === "alerting").length,
      reportingContainers: hosts.reduce(
        (count, host) => count + host.containerCount,
        0,
      ),
    };

    return ok({ hosts, summary });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch hosts", error as Error);
    return err("Failed to fetch hosts.");
  }
};

export { createGetHosts };
