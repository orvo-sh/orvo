import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { agentInstallation } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";

import { quote } from "../../shared/query-builders";

const createGetHosts =
  ({
    db,
    clickhouse,
    logger,
  }: {
    db: DB;
    clickhouse: ClickHouse;
    logger: Logger;
  }) =>
  async (context: { appId: string }) => {
    try {
      const [installations, metricsResult] = await Promise.all([
        db
          .select()
          .from(agentInstallation)
          .where(
            and(
              eq(agentInstallation.appId, context.appId),
              isNull(agentInstallation.revokedAt),
            ),
          ),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
          SELECT
            host_id,
            argMax(host_name, time) AS host_name,
            argMax(host_arch, time) AS host_arch,
            argMax(os_type, time) AS os_type,
            argMax(deployment_environment, time) AS environment,
            max(time) AS last_seen,
            greatest(0, least(1, 1 - avgIf(
              coalesce(value_double, toFloat64(value_int)),
              metric_name = 'system.cpu.utilization'
                AND attributes['state'] = 'idle'
                AND time >= now() - INTERVAL 90 SECOND
            ))) AS cpu_utilization,
            maxIf(
              coalesce(value_double, toFloat64(value_int)),
              metric_name = 'system.memory.utilization'
                AND (attributes['state'] = '' OR attributes['state'] = 'used')
                AND time >= now() - INTERVAL 90 SECOND
            ) AS memory_utilization,
            maxIf(
              coalesce(value_double, toFloat64(value_int)),
              metric_name = 'system.filesystem.utilization'
                AND time >= now() - INTERVAL 90 SECOND
            ) AS filesystem_utilization,
            avgIf(
              coalesce(value_double, toFloat64(value_int)),
              metric_name = 'system.cpu.load_average.1m'
                AND time >= now() - INTERVAL 90 SECOND
            ) AS load_1m
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND entity_kind = 'host'
            AND host_id != ''
            AND time >= now() - INTERVAL 7 DAY
          GROUP BY host_id
          ORDER BY last_seen DESC
        `,
        }),
      ]);

      const rows = (await metricsResult.json()) as unknown as Array<{
        host_id: string;
        host_name: string;
        host_arch: string;
        os_type: string;
        environment: string;
        last_seen: string;
        cpu_utilization: number | string | null;
        memory_utilization: number | string | null;
        filesystem_utilization: number | string | null;
        load_1m: number | string | null;
      }>;
      const metricsByHost = new Map(rows.map((row) => [row.host_id, row]));
      const now = Date.now();

      return ok({
        hosts: installations.map((installation) => {
          const metrics = metricsByHost.get(installation.hostId);
          const lastSeen = metrics?.last_seen
            ? new Date(metrics.last_seen.replace(" ", "T") + "Z").toISOString()
            : null;
          const reporting =
            lastSeen !== null && now - new Date(lastSeen).getTime() <= 120_000;
          const toMetricNumber = (
            value: number | string | null | undefined,
            multiplier = 1,
          ) => {
            const number = Number(value);
            return reporting && value !== null && Number.isFinite(number)
              ? number * multiplier
              : null;
          };

          return {
            id: installation.id,
            hostId: installation.hostId,
            hostName: metrics?.host_name || installation.hostName,
            operatingSystem: metrics?.os_type || installation.operatingSystem,
            architecture: metrics?.host_arch || installation.architecture,
            environment: metrics?.environment || "production",
            agentVersion: installation.agentVersion,
            lastSeen,
            reporting,
            cpuUtilization: toMetricNumber(metrics?.cpu_utilization, 100),
            memoryUtilization: toMetricNumber(metrics?.memory_utilization, 100),
            filesystemUtilization: toMetricNumber(
              metrics?.filesystem_utilization,
              100,
            ),
            load1m: toMetricNumber(metrics?.load_1m),
          };
        }),
      });
    } catch (error) {
      recordError(error);
      logger.error("getHosts: failed to get hosts", error as Error);
      return err("Failed to get hosts.");
    }
  };

export { createGetHosts };
