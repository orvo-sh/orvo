import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { getServiceGraphInputSchema } from "../schema";
import {
  quote,
  toDateTime64,
  type RawServiceGraphEdgeRow,
  type RawServiceGraphNodeRow,
} from "../shared";

const createGetServiceGraph = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getServiceGraphInputSchema>,
  context: { appId: string },
) => {
  const validated = getServiceGraphInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
    const whereClauses = [
      `app_id = ${quote(context.appId)}`,
      `start_time >= ${toDateTime64(startAtUtc)}`,
      `start_time <= ${toDateTime64(endAtUtc)}`,
    ];

    const edgesResult = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          a.service_name AS source,
          b.service_name AS target,
          count() AS total,
          countIf(b.status_code = 2) AS errors
        FROM traces_raw AS a
        INNER JOIN traces_raw AS b
          ON a.trace_id = b.trace_id AND a.span_id = b.parent_span_id
        WHERE ${whereClauses.join(" AND ")}
          AND a.service_name != b.service_name
        GROUP BY source, target
        ORDER BY total DESC
        LIMIT 100
      `,
    });
    const edgeRows = (await edgesResult.json()) as unknown as RawServiceGraphEdgeRow[];

    const nodesResult = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          service_name,
          count() AS total,
          countIf(status_code = 2) AS errors,
          quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
        FROM traces_raw
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY service_name
        ORDER BY total DESC
        LIMIT 50
      `,
    });
    const nodeRows = (await nodesResult.json()) as unknown as RawServiceGraphNodeRow[];

    const nodes = nodeRows.map((row) => ({
      name: row.service_name,
      total: Number(row.total),
      errors: Number(row.errors),
      errorRate:
        Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
      p95LatencyMs: Number(row.p95_latency_ms ?? 0),
    }));

    const edges = edgeRows.map((row) => ({
      source: row.source,
      target: row.target,
      total: Number(row.total),
      errors: Number(row.errors),
      errorRate:
        Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
    }));

    return ok({
      nodes,
      edges,
      startAtUtc: startAtUtc.toISOString(),
      endAtUtc: endAtUtc.toISOString(),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch service graph", error as Error);
    return err("Failed to fetch service graph.");
  }
};

export { createGetServiceGraph };
