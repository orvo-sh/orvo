import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getTraceInputSchema } from "../schema";
import { normalizeDateTime, quote, type RawSpanRow } from "../shared";

const createGetTrace = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTraceInputSchema>,
  context: { appId: string },
) => {
  const validated = getTraceInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          id,
          app_id,
          ingestion_key_id,
          received_at,
          expires_at,
          trace_id,
          span_id,
          parent_span_id,
          trace_state,
          name,
          kind,
          start_time,
          end_time,
          duration_ns,
          status_code,
          status_message,
          resource_attributes,
          scope_attributes,
          span_attributes,
          resource_schema_url,
          scope_name,
          scope_version,
          scope_schema_url,
          events_json,
          links_json,
          service_name,
          deployment_environment
        FROM traces_raw
        WHERE app_id = ${quote(context.appId)}
          AND trace_id = ${quote(validated.data.traceId)}
        ORDER BY start_time ASC
      `,
    });
    const spans = ((await result.json()) as unknown as RawSpanRow[]).map(
      (row) => ({
        ...row,
        received_at: normalizeDateTime(row.received_at),
        expires_at: normalizeDateTime(row.expires_at),
        start_time: normalizeDateTime(row.start_time),
        end_time: normalizeDateTime(row.end_time),
      }),
    );

    return ok({ spans });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch trace", error as Error);
    return err("Failed to fetch trace.");
  }
};

export { createGetTrace };
