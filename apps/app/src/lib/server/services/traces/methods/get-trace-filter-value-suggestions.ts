import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getTraceFilterValueSuggestionsInputSchema } from "../schema";
import {
  buildTraceFilterValueSuggestionsQuery,
  resolveTraceFilterAttributeDefinition,
  traceDurationSuggestionValues,
  type RawFilterValueRow,
} from "../shared";

const createGetTraceFilterValueSuggestions = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTraceFilterValueSuggestionsInputSchema>,
  context: { appId: string },
) => {
  const validated =
    getTraceFilterValueSuggestionsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const definition = resolveTraceFilterAttributeDefinition(
      validated.data.attribute,
    );
    if (!definition) {
      return err("Unknown trace filter attribute.");
    }

    const query = validated.data.query.trim();

    if (definition.kind === "enum") {
      return ok({
        values: ["error", "ok"]
          .filter((value) =>
            query ? value.toLowerCase().includes(query.toLowerCase()) : true,
          )
          .slice(0, validated.data.limit)
          .map((value) => ({ value, count: 0 })),
      });
    }

    if (definition.kind === "duration") {
      return ok({
        values: traceDurationSuggestionValues
          .filter((value) =>
            query ? value.toLowerCase().includes(query.toLowerCase()) : true,
          )
          .slice(0, validated.data.limit)
          .map((value) => ({ value, count: 0 })),
      });
    }

    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: buildTraceFilterValueSuggestionsQuery(
        definition,
        context.appId,
        query,
        validated.data.limit,
      ),
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
    logger.error("Failed to fetch trace filter values", error as Error);
    return err("Failed to fetch trace filter values.");
  }
};

export { createGetTraceFilterValueSuggestions };
