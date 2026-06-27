import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { getTraceMetricsInputSchema } from "../schema";
import {
  quote,
  toDateTime64,
  type RawTraceMetricSummaryRow,
} from "../shared";

const createGetTraceMetrics = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTraceMetricsInputSchema>,
  context: { appId: string },
) => {
  const validated = getTraceMetricsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const timeRange = resolveTimeFilter(validated.data.time);
    const rangeMs = Math.max(
      timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
      1,
    );
    const baselineStart = new Date(timeRange.startAtUtc.getTime() - rangeMs);
    const baselineEnd = timeRange.startAtUtc;
    const bucketCount = validated.data.bucketCount;
    const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);

    const [bucketResult, currentSummaryResult, baselineSummaryResult] =
      await Promise.all([
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            WITH
              ${timeRange.startAtUtc.getTime()} AS start_ms,
              ${bucketSizeMs} AS bucket_ms
            SELECT
              least(toInt32(intDiv(toUnixTimestamp64Milli(start_time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
              count() AS total,
              countIf(status_code = 2) AS errors,
              quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
              AND start_time >= ${toDateTime64(timeRange.startAtUtc)}
              AND start_time <= ${toDateTime64(timeRange.endAtUtc)}
            GROUP BY bucket_index
            ORDER BY bucket_index ASC
          `,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              count() AS total,
              countIf(status_code = 2) AS errors,
              quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
              AND start_time >= ${toDateTime64(timeRange.startAtUtc)}
              AND start_time <= ${toDateTime64(timeRange.endAtUtc)}
          `,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              count() AS total,
              countIf(status_code = 2) AS errors,
              quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
              AND start_time >= ${toDateTime64(baselineStart)}
              AND start_time <= ${toDateTime64(baselineEnd)}
          `,
        }),
      ]);

    const rows = (await bucketResult.json()) as unknown as {
      bucket_index: number;
      total: number;
      errors: number;
      p95_latency_ms: number;
    }[];
    const rowMap = new Map(rows.map((row) => [row.bucket_index, row]));
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(
        timeRange.startAtUtc.getTime() + index * bucketSizeMs,
      );
      const bucketEnd = new Date(
        Math.min(
          timeRange.startAtUtc.getTime() + (index + 1) * bucketSizeMs,
          timeRange.endAtUtc.getTime(),
        ),
      );
      const row = rowMap.get(index);
      const total = Number(row?.total ?? 0);
      const errors = Number(row?.errors ?? 0);

      return {
        startAtUtc: bucketStart.toISOString(),
        endAtUtc: bucketEnd.toISOString(),
        total,
        errors,
        errorRate: total > 0 ? errors / total : 0,
        p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
      };
    });

    const [currentSummaryRow] =
      (await currentSummaryResult.json()) as unknown as RawTraceMetricSummaryRow[];
    const [baselineSummaryRow] =
      (await baselineSummaryResult.json()) as unknown as RawTraceMetricSummaryRow[];

    const toSummary = (row: RawTraceMetricSummaryRow | undefined) => {
      const total = Number(row?.total ?? 0);
      const errors = Number(row?.errors ?? 0);

      return {
        total,
        errors,
        errorRate: total > 0 ? errors / total : 0,
        p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
      };
    };

    return ok({
      buckets,
      summary: toSummary(currentSummaryRow),
      baselineSummary: toSummary(baselineSummaryRow),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch trace metrics", error as Error);
    return err("Failed to fetch trace metrics.");
  }
};

export { createGetTraceMetrics };
