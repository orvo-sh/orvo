import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { getTraceSummaryInputSchema } from "../schema";
import { buildTraceSummaryWhereClause, type RawTraceSummaryRow } from "../shared";

const createGetTraceSummary = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTraceSummaryInputSchema>,
  context: { appId: string },
) => {
  const validated = getTraceSummaryInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
    const whereClause = buildTraceSummaryWhereClause(
      context.appId,
      validated.data,
    );
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          uniqExact(trace_id) AS total,
          uniqExactIf(trace_id, status_code = 2) AS error_traces,
          quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms,
          uniqExact(service_name) AS service_count
        FROM traces_raw
        WHERE ${whereClause}
      `,
    });
    const rows = (await result.json()) as unknown as RawTraceSummaryRow[];
    const row = rows[0];
    const total = Number(row?.total ?? 0);
    const errorTraces = Number(row?.error_traces ?? 0);

    return ok({
      total,
      errorTraces,
      errorRate: total > 0 ? errorTraces / total : 0,
      p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
      serviceCount: Number(row?.service_count ?? 0),
      startAtUtc: startAtUtc.toISOString(),
      endAtUtc: endAtUtc.toISOString(),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch trace summary", error as Error);
    return err("Failed to fetch trace summary.");
  }
};

export { createGetTraceSummary };
