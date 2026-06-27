import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings } from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import { getLogServiceSummaryInputSchema } from "../schema";
import { buildWhereClause, normalizeDateTime } from "./shared";

const createGetLogServiceSummary = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getLogServiceSummaryInputSchema>,
  context: { appId: string },
) => {
    const validated = getLogServiceSummaryInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const bindings = createQueryBindings();
      const whereClause = buildWhereClause(bindings, context.appId, {
        time: validated.data.time,
        activeFilters: [],
      });

      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        SELECT
          service_name,
          count() AS total,
          countIf(lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors,
          max(timestamp) AS last_seen
        FROM logs_raw
        WHERE ${whereClause}
        GROUP BY service_name
        ORDER BY total DESC
        LIMIT 20
      `,
        query_params: bindings.query_params,
      });

      const rows = (await result.json()) as unknown as {
        service_name: string;
        total: number | string;
        errors: number | string;
        last_seen: string | Date;
      }[];

      return ok({
        services: rows.map((row) => ({
          name: row.service_name,
          total: Number(row.total),
          errors: Number(row.errors),
          lastSeen: normalizeDateTime(row.last_seen),
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

export { createGetLogServiceSummary };
