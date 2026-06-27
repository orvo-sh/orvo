import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

import { createQueryBindings } from "../../shared/query-builders";
import {
  collectLogJsonFilterAttributes,
  createDynamicLogFilterAttribute,
  logSearchBaseAttributes,
  type RawAttributeKeyRow,
  type RawAttributeValueRow,
} from "./shared";

const createGetLogFilterAttributes = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (context: { appId: string }) => {
  try {
    const resourceBindings = createQueryBindings();
    const scopeBindings = createQueryBindings();
    const logBindings = createQueryBindings();
    const logValueBindings = createQueryBindings();

    const [resourceResult, scopeResult, logResult, logValueResult] =
      await Promise.all([
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(resource_attributes)) AS key
              FROM logs_raw
              WHERE app_id = ${resourceBindings.bindString("app_id", context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
          query_params: resourceBindings.query_params,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(scope_attributes)) AS key
              FROM logs_raw
              WHERE app_id = ${scopeBindings.bindString("app_id", context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
          query_params: scopeBindings.query_params,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(log_attributes)) AS key
              FROM logs_raw
              WHERE app_id = ${logBindings.bindString("app_id", context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
          query_params: logBindings.query_params,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              tupleElement(entry, 1) AS key,
              tupleElement(entry, 2) AS value
            FROM (
              SELECT arrayJoin(arrayZip(mapKeys(log_attributes), mapValues(log_attributes))) AS entry
              FROM logs_raw
              WHERE app_id = ${logValueBindings.bindString("app_id", context.appId)}
            )
            WHERE key != ''
              AND value != ''
            LIMIT 5000
          `,
          query_params: logValueBindings.query_params,
        }),
      ]);

    const resourceKeys =
      (await resourceResult.json()) as unknown as RawAttributeKeyRow[];
    const scopeKeys = (await scopeResult.json()) as unknown as RawAttributeKeyRow[];
    const logKeys = (await logResult.json()) as unknown as RawAttributeKeyRow[];
    const logValues =
      (await logValueResult.json()) as unknown as RawAttributeValueRow[];
    const nestedLogAttributes = collectLogJsonFilterAttributes(logValues);

    return ok({
      attributes: [
        ...logSearchBaseAttributes,
        ...resourceKeys.map((row) => ({
          ...createDynamicLogFilterAttribute("resource", row.key),
        })),
        ...scopeKeys.map((row) => ({
          ...createDynamicLogFilterAttribute("scope", row.key),
        })),
        ...logKeys.map((row) => ({
          ...createDynamicLogFilterAttribute("attribute", row.key),
        })),
        ...nestedLogAttributes,
      ],
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch log filter attributes", error as Error);
    return err("Failed to fetch log filter attributes.");
  }
};

export { createGetLogFilterAttributes };
