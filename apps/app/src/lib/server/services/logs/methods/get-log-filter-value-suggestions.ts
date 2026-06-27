import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings } from "../../shared/query-builders";
import { getLogFilterValueSuggestionsInputSchema } from "../schema";
import {
  buildLogFilterValueSuggestionsQuery,
  resolveLogFilterAttributeDefinition,
  type RawFilterValueRow,
} from "./shared";

const createGetLogFilterValueSuggestions = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getLogFilterValueSuggestionsInputSchema>,
  context: { appId: string },
) => {
    const validated = getLogFilterValueSuggestionsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const definition = resolveLogFilterAttributeDefinition(
        validated.data.attribute,
      );
      if (!definition) {
        return err("Unknown log filter attribute.");
      }

      const bindings = createQueryBindings();
      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: buildLogFilterValueSuggestionsQuery(
          bindings,
          definition,
          context.appId,
          validated.data.query.trim(),
          validated.data.limit,
        ),
        query_params: bindings.query_params,
      });
      const rows = (await result.json()) as unknown as RawFilterValueRow[];

      return ok({
        values: rows.map((row) => ({
          value: row.value,
          count: Number(row.count ?? 0),
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch log filter values", error as Error);
      return err("Failed to fetch log filter values.");
    }
  };

export { createGetLogFilterValueSuggestions };
