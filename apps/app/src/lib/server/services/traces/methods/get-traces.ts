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
  type RawTraceRow,
} from "../shared";
import { getTraceDisplayName } from "./get-trace-display-name";

type RawTraceListRow = RawTraceRow & {
  root_span_id?: string | null;
  kind?: string | null;
  span_attributes?: Record<string, unknown> | string | null;
};

const rootSpanCondition =
  "(isNull(parent_span_id) OR parent_span_id = '' OR parent_span_id = '0000000000000000')";

const rootPickOrder = `tuple(if(${rootSpanCondition}, 0, 1), start_time)`;

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

      const sortColumn =
        validated.data.sortBy === "duration"
          ? "duration_ns"
          : validated.data.sortBy === "span_count"
            ? "span_count"
            : validated.data.sortBy === "trace_name"
              ? "name"
              : "trace_start_time";

      const sortDirection = validated.data.sortOrder === "asc" ? "ASC" : "DESC";
      const traceIdDirection = sortDirection;

      const outerWhereClauses = [];

      if (validated.data.cursor) {
        const comparisonOperator = validated.data.sortOrder === "asc" ? ">" : "<";
        const cursorSortValue = `(
          SELECT ${sortColumn}
          FROM (
            SELECT
              trace_id,
              argMin(name, ${rootPickOrder}) AS name,
              min(start_time) AS trace_start_time,
              toInt64(
                toUnixTimestamp64Nano(max(end_time)) -
                toUnixTimestamp64Nano(min(start_time))
              ) AS duration_ns,
              count() AS span_count
            FROM traces_raw
            WHERE ${whereClause}
            GROUP BY trace_id
          )
          WHERE trace_id = ${quote(validated.data.cursor)}
          LIMIT 1
        )`;

        outerWhereClauses.push(
          `(${sortColumn} ${comparisonOperator} ${cursorSortValue} OR (${sortColumn} = ${cursorSortValue} AND trace_id ${comparisonOperator} ${quote(validated.data.cursor)}))`,
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
          id,
          trace_id,
          root_span_id,
          name,
          kind,
          span_attributes,
          trace_start_time AS start_time,
          trace_end_time AS end_time,
          duration_ns,
          span_count,
          error_count,
          service_names,
          deployment_environments
        FROM (
          SELECT
            argMin(id, ${rootPickOrder}) AS id,
            trace_id,
            argMin(span_id, ${rootPickOrder}) AS root_span_id,
            argMin(name, ${rootPickOrder}) AS name,
            argMin(kind, ${rootPickOrder}) AS kind,
            argMin(span_attributes, ${rootPickOrder}) AS span_attributes,

            min(start_time) AS trace_start_time,
            max(end_time) AS trace_end_time,

            toInt64(
              toUnixTimestamp64Nano(max(end_time)) -
              toUnixTimestamp64Nano(min(start_time))
            ) AS duration_ns,

            count() AS span_count,
            countIf(status_code = 2) AS error_count,

            arrayFilter(
              value -> value != '',
              groupUniqArray(service_name)
            ) AS service_names,

            arrayFilter(
              value -> value != '',
              groupUniqArray(deployment_environment)
            ) AS deployment_environments

          FROM traces_raw
          WHERE ${whereClause}
          GROUP BY trace_id
        )
        ${outerWhere}
        ORDER BY ${sortColumn} ${sortDirection}, trace_id ${traceIdDirection}
        LIMIT ${pageSize}
      `,
      });

      const rows = (await result.json()) as unknown as RawTraceListRow[];

      const hasNextPage = rows.length > validated.data.limit;

      const visibleRows = rows.slice(0, validated.data.limit).map((row) => {
        const normalizedRow = {
          ...row,
          error_count: Number(row.error_count),
          duration_ns: Number(row.duration_ns),
          start_time: normalizeDateTime(row.start_time),
          end_time: normalizeDateTime(row.end_time),
        };

        const displayName = getTraceDisplayName(normalizedRow);

        return {
          id: normalizedRow.id,
          trace_id: normalizedRow.trace_id,
          name: normalizedRow.name,
          start_time: normalizedRow.start_time,
          end_time: normalizedRow.end_time,
          duration_ns: normalizedRow.duration_ns,
          span_count: normalizedRow.span_count,
          error_count: normalizedRow.error_count,
          service_names: normalizedRow.service_names,
          deployment_environments: normalizedRow.deployment_environments,
          ...displayName,
        };
      });

      const lastRow = visibleRows.at(-1);

      return ok({
        traces: visibleRows,
        nextCursor: hasNextPage && lastRow ? lastRow.trace_id : null,
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch traces", error as Error);

      return err("Failed to fetch traces.");
    }
  };

export { createGetTraces };
