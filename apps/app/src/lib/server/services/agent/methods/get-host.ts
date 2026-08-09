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

      const [latestResult, seriesResult] = await Promise.all([
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              argMax(host_name, time) AS host_name,
              argMax(host_arch, time) AS host_arch,
              argMax(os_type, time) AS os_type,
              argMax(deployment_environment, time) AS reported_environment,
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
              AND host_id = ${quote(installation.hostId)}
              AND entity_kind = 'host'
              AND time >= now() - INTERVAL 7 DAY
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
              maxIf(
                coalesce(value_double, toFloat64(value_int)),
                metric_name = 'system.filesystem.utilization'
              ) AS filesystem_utilization,
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
      ]);

      const [latest] = (await latestResult.json()) as unknown as Array<{
        host_name: string;
        host_arch: string;
        os_type: string;
        reported_environment: string;
        last_seen: string | null;
        cpu_utilization: number | string | null;
        memory_utilization: number | string | null;
        filesystem_utilization: number | string | null;
        load_1m: number | string | null;
      }>;
      const series = (await seriesResult.json()) as unknown as Array<{
        bucket: string;
        cpu_utilization: number | string | null;
        memory_utilization: number | string | null;
        filesystem_utilization: number | string | null;
        load_1m: number | string | null;
      }>;
      const lastSeen = latest?.last_seen
        ? new Date(latest.last_seen.replace(" ", "T") + "Z").toISOString()
        : null;
      const reporting =
        lastSeen !== null &&
        Date.now() - new Date(lastSeen).getTime() <= 120_000;
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
          agentVersion: installation.agentVersion,
          installedAt: installation.createdAt,
          lastSeen,
          reporting,
          cpuUtilization: toNumber(latest?.cpu_utilization, 100, true),
          memoryUtilization: toNumber(latest?.memory_utilization, 100, true),
          filesystemUtilization: toNumber(
            latest?.filesystem_utilization,
            100,
            true,
          ),
          load1m: toNumber(latest?.load_1m, 1, true),
        },
        series: series.map((point) => ({
          timestamp: new Date(
            point.bucket.replace(" ", "T") + "Z",
          ).toISOString(),
          cpuUtilization: toNumber(point.cpu_utilization, 100),
          memoryUtilization: toNumber(point.memory_utilization, 100),
          filesystemUtilization: toNumber(point.filesystem_utilization, 100),
          load1m: toNumber(point.load_1m),
        })),
        time: validated.data.time,
      });
    } catch (error) {
      recordError(error);
      logger.error("getHost: failed to get host", error as Error);
      return err("Failed to get host.");
    }
  };

export { createGetHost };
