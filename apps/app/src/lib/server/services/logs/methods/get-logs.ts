import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import {
  createQueryBindings,
  normalizeDateTime,
} from "../../shared/query-builders";
import { getLogsInputSchema } from "../schema";
import { buildWhereClause } from "./shared";

const createGetLogs =
  ({ clickhouse, logger }: { clickhouse: ClickHouse; logger: Logger }) =>
  async (
    input: z.input<typeof getLogsInputSchema>,
    context: { appId: string },
  ) => {
    const validated = getLogsInputSchema.safeParse(input);

    if (!validated.success) {
      logger.warn("Invalid input", {
        appId: context.appId,
        issues: validated.error.issues,
      });
      return err(validated.error.message);
    }

    try {
      const bindings = createQueryBindings();
      const pageSize = validated.data.limit + 1;
      const baseWhereClause = buildWhereClause(
        bindings,
        context.appId,
        validated.data,
      );
      const isTimestampSort = validated.data.sortBy === "timestamp";
      const sortColumn =
        validated.data.sortBy === "severity"
          ? "logs.severity_number"
          : validated.data.sortBy === "service"
            ? "lowerUTF8(logs.service_name)"
            : "logs.timestamp";
      const cursorSortColumn =
        validated.data.sortBy === "severity"
          ? "severity_number"
          : validated.data.sortBy === "service"
            ? "lowerUTF8(service_name)"
            : "timestamp";
      const primarySortDirection =
        validated.data.sortOrder === "asc" ? "ASC" : "DESC";
      const primaryComparisonOperator =
        validated.data.sortOrder === "asc" ? ">" : "<";
      const cursorId = validated.data.cursor
        ? bindings.bindString("cursor_id", validated.data.cursor)
        : null;
      const cursorBaseQuery =
        validated.data.cursor === undefined
          ? null
          : `
          SELECT
            ${cursorSortColumn} AS sort_value,
            timestamp,
            id
          FROM logs_raw
          WHERE app_id = ${bindings.bindString("cursor_app_id", context.appId)}
            AND id = ${cursorId}
          LIMIT 1
        `;
      const cursorSortValue =
        cursorBaseQuery === null
          ? null
          : `(
          SELECT sort_value
          FROM (${cursorBaseQuery})
        )`;
      const cursorTimestamp =
        cursorBaseQuery === null
          ? null
          : `(
          SELECT timestamp
          FROM (${cursorBaseQuery})
        )`;
      const cursorCondition =
        validated.data.cursor === undefined ||
        cursorId === null ||
        cursorSortValue === null ||
        cursorTimestamp === null
          ? ""
          : isTimestampSort
            ? `AND (
              logs.timestamp ${primaryComparisonOperator} ${cursorTimestamp}
              OR (
                logs.timestamp = ${cursorTimestamp}
                AND logs.id ${primaryComparisonOperator} ${cursorId}
              )
            )`
            : `AND (
              ${sortColumn} ${primaryComparisonOperator} ${cursorSortValue}
              OR (
                ${sortColumn} = ${cursorSortValue}
                AND (
                  logs.timestamp < ${cursorTimestamp}
                  OR (
                    logs.timestamp = ${cursorTimestamp}
                    AND logs.id < ${cursorId}
                  )
                )
              )
            )`;
      const orderByClause = isTimestampSort
        ? `logs.timestamp ${primarySortDirection}, logs.id ${primarySortDirection}`
        : `${sortColumn} ${primarySortDirection}, logs.timestamp DESC, logs.id DESC`;

      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        WITH trace_objects AS (
          SELECT
            app_id,
            trace_id,
            argMin(
              id,
              tuple(
                if(
                  isNull(parent_span_id) OR parent_span_id = '' OR parent_span_id = '0000000000000000',
                  0,
                  1
                ),
                start_time
              )
            ) AS trace_object_id
          FROM traces_raw
          WHERE app_id = ${bindings.bindString("trace_object_app_id", context.appId)}
          GROUP BY app_id, trace_id
        )
        SELECT
          logs.id,
          logs.app_id,
          logs.ingestion_key_id,
          logs.received_at,
          logs.expires_at,
          logs.timestamp,
          logs.observed_timestamp,
          logs.severity_number,
          logs.severity_text,
          logs.body,
          traces.trace_object_id AS trace_id,
          logs.span_id,
          logs.trace_flags,
          logs.resource_attributes,
          logs.resource_schema_url,
          logs.scope_name,
          logs.scope_version,
          logs.scope_attributes,
          logs.scope_schema_url,
          logs.log_attributes,
          logs.service_name,
          logs.deployment_environment
        FROM logs_raw AS logs
        LEFT JOIN trace_objects AS traces
          ON traces.app_id = logs.app_id
         AND traces.trace_id = logs.trace_id
        WHERE ${baseWhereClause}
        ${cursorCondition}
        ORDER BY ${orderByClause}
        LIMIT ${bindings.bindUInt32("limit", pageSize)}
      `,
        query_params: bindings.query_params,
      });

      const rows = (await result.json()) as unknown as {
        id: string;
        app_id: string;
        ingestion_key_id: string;
        received_at: string | Date;
        expires_at: string | Date;
        timestamp: string | Date;
        observed_timestamp: string | Date;
        severity_number: number;
        severity_text: string;
        body: string;
        trace_id: string | null;
        span_id: string;
        trace_flags: number;
        resource_attributes: Record<string, string>;
        resource_schema_url: string;
        scope_name: string;
        scope_version: string;
        scope_attributes: Record<string, string>;
        scope_schema_url: string;
        log_attributes: Record<string, string>;
        service_name: string;
        deployment_environment: string;
      }[];

      const hasNextPage = rows.length > validated.data.limit;
      const visibleRows = rows.slice(0, validated.data.limit).map((row) => ({
        ...row,
        received_at: normalizeDateTime(row.received_at),
        expires_at: normalizeDateTime(row.expires_at),
        timestamp: normalizeDateTime(row.timestamp),
        observed_timestamp: normalizeDateTime(row.observed_timestamp),
      }));
      const lastRow = visibleRows.at(-1);

      return ok({
        logs: visibleRows,
        nextCursor: hasNextPage && lastRow ? lastRow.id : null,
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch logs", error as Error);
      return err("Failed to fetch logs.");
    }
  };

export { createGetLogs };
