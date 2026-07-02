import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import {
  createQueryBindings,
  normalizeDateTime,
} from "../../shared/query-builders";
import { getLogByIdInputSchema } from "../schema";

const createGetLogById = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getLogByIdInputSchema>,
  context: { appId: string },
) => {
  const validated = getLogByIdInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const bindings = createQueryBindings();
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
        WHERE logs.app_id = ${bindings.bindString("app_id", context.appId)}
          AND logs.id = ${bindings.bindString("log_id", validated.data.id)}
        ORDER BY logs.timestamp DESC
        LIMIT 1
      `,
      query_params: bindings.query_params,
    });

    const rows = (await result.json()) as unknown as Array<{
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
    }>;
    const row = rows[0];

    if (!row) {
      return ok({ log: null });
    }

    return ok({
      log: {
        ...row,
        received_at: normalizeDateTime(row.received_at),
        expires_at: normalizeDateTime(row.expires_at),
        timestamp: normalizeDateTime(row.timestamp),
        observed_timestamp: normalizeDateTime(row.observed_timestamp),
      },
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch log by id", error as Error);
    return err("Failed to fetch log.");
  }
};

export { createGetLogById };
