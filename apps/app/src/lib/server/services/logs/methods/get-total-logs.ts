import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings } from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import { getTotalLogsInputSchema } from "../schema";

const createGetTotalLogs = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getTotalLogsInputSchema>,
  context: { appId: string },
) => {
    const validated = getTotalLogsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const bindings = createQueryBindings();
      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        SELECT count() AS total
        FROM logs_raw
        WHERE app_id = ${bindings.bindString("app_id", context.appId)}
          AND timestamp >= ${bindings.bindDateTime64("start_at", startAtUtc)}
          AND timestamp <= ${bindings.bindDateTime64("end_at", endAtUtc)}
      `,
        query_params: bindings.query_params,
      });
      const rows = (await result.json()) as unknown as Array<{
        total: number | string;
      }>;

      return ok({ total: Number(rows[0]?.total ?? 0) });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch total logs", error as Error);
      return err("Failed to fetch total logs.");
    }
  };

export { createGetTotalLogs };
