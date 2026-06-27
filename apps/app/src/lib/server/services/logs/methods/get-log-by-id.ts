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
        WHERE app_id = ${bindings.bindString("app_id", context.appId)}
          AND id = ${bindings.bindString("log_id", validated.data.id)}
        ORDER BY timestamp DESC
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
