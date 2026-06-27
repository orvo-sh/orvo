import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { getTraceServiceSummaryInputSchema } from "../schema";
import {
  quote,
  toDateTime64,
  type RawTraceServiceSummaryRow,
} from "../shared";

const createGetTraceServiceSummary = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTraceServiceSummaryInputSchema>,
  context: { appId: string },
) => {
  const validated = getTraceServiceSummaryInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
    const whereClauses = [
      `app_id = ${quote(context.appId)}`,
      `start_time >= ${toDateTime64(startAtUtc)}`,
      `start_time <= ${toDateTime64(endAtUtc)}`,
    ];

    const bucketCount = 15;
    const rangeMs = Math.max(endAtUtc.getTime() - startAtUtc.getTime(), 1);
    const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);

    const [summaryResult, bucketResult] = await Promise.all([
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            service_name,
            count() AS total,
            countIf(status_code = 2) AS errors,
            quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
          FROM traces_raw
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY service_name
          ORDER BY total DESC
          LIMIT 20
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          WITH
            ${startAtUtc.getTime()} AS start_ms,
            ${bucketSizeMs} AS bucket_ms
          SELECT
            service_name,
            least(toInt32(intDiv(toUnixTimestamp64Milli(start_time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
            count() AS total
          FROM traces_raw
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY service_name, bucket_index
          ORDER BY service_name, bucket_index ASC
        `,
      }),
    ]);

    const rows = (await summaryResult.json()) as unknown as RawTraceServiceSummaryRow[];
    const bucketRows = (await bucketResult.json()) as unknown as Array<{
      service_name: string;
      bucket_index: number;
      total: number | string;
    }>;

    const bucketMap = new Map<string, number[]>();
    for (const row of bucketRows) {
      const name = row.service_name;
      const index = Number(row.bucket_index);
      const total = Number(row.total);
      if (!bucketMap.has(name)) {
        bucketMap.set(name, Array.from({ length: bucketCount }, () => 0));
      }
      const arr = bucketMap.get(name)!;
      arr[index] = (arr[index] ?? 0) + total;
    }

    return ok({
      services: rows.map((row) => ({
        name: row.service_name,
        total: Number(row.total),
        errors: Number(row.errors),
        errorRate:
          Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
        p95LatencyMs: Number(row.p95_latency_ms ?? 0),
        buckets: bucketMap.get(row.service_name) ?? [],
      })),
      startAtUtc: startAtUtc.toISOString(),
      endAtUtc: endAtUtc.toISOString(),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch service summary", error as Error);
    return err("Failed to fetch service summary.");
  }
};

export { createGetTraceServiceSummary };
