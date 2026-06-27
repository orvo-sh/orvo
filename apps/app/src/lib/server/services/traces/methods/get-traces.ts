import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getTracesInputSchema } from "../schema";
import {
  buildInClause,
  buildOuterConditionClause,
  buildWhereClause,
  normalizeDateTime,
  quote,
  toDateTime64,
  type RawTraceRow,
} from "../shared";

const createGetTraces = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTracesInputSchema>,
  context: { appId: string },
) => {
  const validated = getTracesInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const pageSize = validated.data.limit + 1;
    const whereClause = buildWhereClause(context.appId, validated.data);

    const outerWhereClauses = [];
    if (validated.data.cursor) {
      outerWhereClauses.push(
        `(trace_start_time < ${toDateTime64(new Date(validated.data.cursor.startTime))} OR (trace_start_time = ${toDateTime64(new Date(validated.data.cursor.startTime))} AND trace_id < ${quote(validated.data.cursor.traceId)}))`,
      );
    }
    for (const condition of validated.data.conditions) {
      const clause = buildOuterConditionClause(condition);
      if (clause) {
        outerWhereClauses.push(clause);
      }
    }
    if (validated.data.operations.length > 0) {
      outerWhereClauses.push(buildInClause("name", validated.data.operations));
    }
    if (validated.data.traceIds.length > 0) {
      outerWhereClauses.push(buildInClause("trace_id", validated.data.traceIds));
    }
    if (validated.data.statuses.length === 1) {
      outerWhereClauses.push(
        validated.data.statuses[0] === "error"
          ? "error_count > 0"
          : "error_count = 0",
      );
    }
    if (validated.data.minDurationNs !== undefined) {
      outerWhereClauses.push(`duration_ns >= ${validated.data.minDurationNs}`);
    }
    if (validated.data.maxDurationNs !== undefined) {
      outerWhereClauses.push(`duration_ns <= ${validated.data.maxDurationNs}`);
    }
    const outerWhere =
      outerWhereClauses.length > 0
        ? `WHERE ${outerWhereClauses.join(" AND ")}`
        : "";

    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          trace_id,
          name,
          trace_start_time AS start_time,
          trace_end_time AS end_time,
          duration_ns,
          span_count,
          error_count,
          service_names,
          deployment_environments
        FROM (
          SELECT
            trace_id,
            coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS name,
            min(start_time) AS trace_start_time,
            max(end_time) AS trace_end_time,
            toInt64(toUnixTimestamp64Nano(max(end_time)) - toUnixTimestamp64Nano(min(start_time))) AS duration_ns,
            count() AS span_count,
            countIf(status_code = 2) AS error_count,
            arrayFilter(value -> value != '', groupUniqArray(service_name)) AS service_names,
            arrayFilter(value -> value != '', groupUniqArray(deployment_environment)) AS deployment_environments
          FROM traces_raw
          WHERE ${whereClause}
          GROUP BY trace_id
        )
        ${outerWhere}
        ORDER BY trace_start_time DESC, trace_id DESC
        LIMIT ${pageSize}
      `,
    });
    const rows = (await result.json()) as unknown as RawTraceRow[];
    const hasNextPage = rows.length > validated.data.limit;
    const visibleRows = rows.slice(0, validated.data.limit).map((row) => ({
      ...row,
      start_time: normalizeDateTime(row.start_time),
      end_time: normalizeDateTime(row.end_time),
    }));
    const lastRow = visibleRows.at(-1);

    return ok({
      traces: visibleRows,
      nextCursor:
        hasNextPage && lastRow
          ? {
              startTime: lastRow.start_time,
              traceId: lastRow.trace_id,
            }
          : null,
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch traces", error as Error);
    return err("Failed to fetch traces.");
  }
};

export { createGetTraces };
