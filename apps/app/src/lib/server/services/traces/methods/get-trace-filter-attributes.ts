import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

import {
  createDynamicTraceFilterAttribute,
  quote,
  traceSearchBaseAttributes,
  type RawAttributeKeyRow,
} from "../shared";

const createGetTraceFilterAttributes = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (context: { appId: string }) => {
  try {
    const [resourceResult, scopeResult, spanResult] = await Promise.all([
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT key, count() AS count
          FROM (
            SELECT arrayJoin(mapKeys(resource_attributes)) AS key
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
          )
          WHERE key != ''
          GROUP BY key
          ORDER BY count DESC, key ASC
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT key, count() AS count
          FROM (
            SELECT arrayJoin(mapKeys(scope_attributes)) AS key
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
          )
          WHERE key != ''
          GROUP BY key
          ORDER BY count DESC, key ASC
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT key, count() AS count
          FROM (
            SELECT arrayJoin(mapKeys(span_attributes)) AS key
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
          )
          WHERE key != ''
          GROUP BY key
          ORDER BY count DESC, key ASC
        `,
      }),
    ]);

    const resourceKeys = (await resourceResult.json()) as unknown as RawAttributeKeyRow[];
    const scopeKeys = (await scopeResult.json()) as unknown as RawAttributeKeyRow[];
    const spanKeys = (await spanResult.json()) as unknown as RawAttributeKeyRow[];

    return ok({
      attributes: [
        ...traceSearchBaseAttributes,
        ...resourceKeys.map((row) =>
          createDynamicTraceFilterAttribute("resource", row.key),
        ),
        ...scopeKeys.map((row) =>
          createDynamicTraceFilterAttribute("scope", row.key),
        ),
        ...spanKeys.map((row) =>
          createDynamicTraceFilterAttribute("span", row.key),
        ),
      ],
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch trace filter attributes", error as Error);
    return err("Failed to fetch trace filter attributes.");
  }
};

export { createGetTraceFilterAttributes };
