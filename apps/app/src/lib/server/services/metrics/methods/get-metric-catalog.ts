import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getMetricCatalogInputSchema } from "../schema";
import {
  buildMetricCatalogWhereClause,
  normalizeDateTime,
} from "../shared";

const createGetMetricCatalog = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getMetricCatalogInputSchema>,
  context: { appId: string },
) => {
  const validated = getMetricCatalogInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const whereClause = buildMetricCatalogWhereClause(
      context.appId,
      validated.data,
    );
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          metric_name,
          any(metric_type) AS metric_type,
          any(metric_unit) AS metric_unit,
          any(description) AS description,
          count() AS points,
          uniqExactIf(service_name, service_name != '') AS services,
          uniqExactIf(container_id, container_id != '') AS containers,
          any(is_monotonic) AS is_monotonic,
          max(time) AS last_seen,
          argMax(coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)), time) AS last_value
        FROM metrics_raw
        WHERE ${whereClause}
        GROUP BY metric_name
        ORDER BY metric_name ASC
        LIMIT ${validated.data.limit}
      `,
    });
    const rows = (await result.json()) as unknown as Array<{
      metric_name: string;
      metric_type: string;
      metric_unit: string;
      description: string;
      points: number | string;
      services: number | string;
      containers: number | string;
      is_monotonic: boolean | number;
      last_seen: string | Date;
      last_value: number | string | null;
    }>;

    return ok({
      catalog: rows.map((row) => ({
        name: row.metric_name,
        type: row.metric_type,
        unit: row.metric_unit,
        description: row.description,
        points: Number(row.points),
        services: Number(row.services),
        containers: Number(row.containers),
        isMonotonic: Boolean(row.is_monotonic),
        lastSeen: normalizeDateTime(row.last_seen),
        lastValue: row.last_value === null ? null : Number(row.last_value),
      })),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch metric catalog", error as Error);
    return err("Failed to fetch metric catalog.");
  }
};

export { createGetMetricCatalog };
