import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings, normalizeDateTime } from "../../shared/query-builders";
import { getLogsInputSchema } from "../schema";
import { buildWhereClause, } from "./shared";

const createGetLogs = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
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
      const whereClause = buildWhereClause(
        bindings,
        context.appId,
        validated.data,
        {
          cursor: validated.data.cursor,
        },
      );

      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        SELECT
          id,
          app_id,
          ingestion_key_id,
          received_at,
          expires_at,
          timestamp,
          observed_timestamp,
          severity_number,
          severity_text,
          body,
          trace_id,
          span_id,
          trace_flags,
          resource_attributes,
          resource_schema_url,
          scope_name,
          scope_version,
          scope_attributes,
          scope_schema_url,
          log_attributes,
          service_name,
          deployment_environment
        FROM logs_raw
        WHERE ${whereClause}
        ORDER BY timestamp DESC, id DESC
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
        trace_id: string;
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
        nextCursor:
          hasNextPage && lastRow
            ? {
              id: lastRow.id,
              timestamp: lastRow.timestamp,
            }
            : null,
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch logs", error as Error);
      return err("Failed to fetch logs.");
    }
  };

export { createGetLogs };
