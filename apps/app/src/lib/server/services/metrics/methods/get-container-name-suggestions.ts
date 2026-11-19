import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import { getContainerNameSuggestionsInputSchema } from "../schema";
import { quote } from "../../shared/query-builders";

const createGetContainerNameSuggestions =
  ({ clickhouse, logger }: { clickhouse: ClickHouse; logger: Logger }) =>
  async (
    input: z.input<typeof getContainerNameSuggestionsInputSchema>,
    context: { appId: string },
  ) => {
    const validated = getContainerNameSuggestionsInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);
    try {
      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT container_name AS value, count() AS count
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND container_name != ''
            AND positionCaseInsensitiveUTF8(container_name, ${quote(validated.data.query)}) > 0
          GROUP BY container_name
          ORDER BY count DESC, value ASC
          LIMIT ${validated.data.limit}
        `,
      });
      const rows = (await result.json()) as unknown as {
        value: string;
        count: string | number;
      }[];
      return ok({
        values: rows.map(({ value, count }) => ({
          value,
          count: Number(count),
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "getContainerNameSuggestions: failed to fetch container names",
        error as Error,
      );
      return err("Failed to load container names.");
    }
  };

export { createGetContainerNameSuggestions };
