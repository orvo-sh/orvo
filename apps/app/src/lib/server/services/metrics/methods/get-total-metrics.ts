import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { quote, toDateTime64 } from "../../shared/query-builders";
import { getTotalMetricsInputSchema } from "../schema";

const createGetTotalMetrics = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTotalMetricsInputSchema>,
  context: { appId: string },
) => {
  const validated = getTotalMetricsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT count() AS total
        FROM metrics_raw
        WHERE app_id = ${quote(context.appId)}
          AND time >= ${toDateTime64(startAtUtc)}
          AND time <= ${toDateTime64(endAtUtc)}
      `,
    });
    const rows = (await result.json()) as unknown as Array<{
      total: number | string;
    }>;
    return ok({ total: Number(rows[0]?.total ?? 0) });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch total metrics", error as Error);
    return err("Failed to fetch total metrics.");
  }
};

const createGetMetricsTrend = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTotalMetricsInputSchema>,
  context: { appId: string },
) => {
  const validated = getTotalMetricsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
    const rangeMs = endAtUtc.getTime() - startAtUtc.getTime();
    const baselineStart = new Date(startAtUtc.getTime() - rangeMs);
    const baselineEnd = startAtUtc;

    const [currentResult, baselineResult] = await Promise.all([
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT count() AS total
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND time >= ${toDateTime64(startAtUtc)}
            AND time <= ${toDateTime64(endAtUtc)}
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT count() AS total
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND time >= ${toDateTime64(baselineStart)}
            AND time <= ${toDateTime64(baselineEnd)}
        `,
      }),
    ]);

    const currentRows = (await currentResult.json()) as unknown as Array<{
      total: number | string;
    }>;
    const baselineRows = (await baselineResult.json()) as unknown as Array<{
      total: number | string;
    }>;

    const current = Number(currentRows[0]?.total ?? 0);
    const baseline = Number(baselineRows[0]?.total ?? 0);
    const trend =
      baseline > 0
        ? ((current - baseline) / baseline) * 100
        : current > 0
          ? 100
          : 0;

    return ok({ total: current, trend });
  } catch (error) {
    recordError(error);
    logger.error("Failed to compute metric trend", error as Error);
    return err("Failed to compute metric trend.");
  }
};

export { createGetMetricsTrend, createGetTotalMetrics };
