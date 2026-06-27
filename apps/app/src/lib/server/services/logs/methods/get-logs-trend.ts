import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings } from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import { getTotalLogsInputSchema } from "../schema";

const createGetLogsTrend = ({
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
      const rangeMs = endAtUtc.getTime() - startAtUtc.getTime();
      const baselineStart = new Date(startAtUtc.getTime() - rangeMs);
      const baselineEnd = startAtUtc;
      const currentBindings = createQueryBindings();
      const baselineBindings = createQueryBindings();

      const [currentResult, baselineResult] = await Promise.all([
        clickhouse.query({
          format: "JSONEachRow",
          query: `
          SELECT count() AS total
          FROM logs_raw
          WHERE app_id = ${currentBindings.bindString("app_id", context.appId)}
            AND timestamp >= ${currentBindings.bindDateTime64("start_at", startAtUtc)}
            AND timestamp <= ${currentBindings.bindDateTime64("end_at", endAtUtc)}
        `,
          query_params: currentBindings.query_params,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `
          SELECT count() AS total
          FROM logs_raw
          WHERE app_id = ${baselineBindings.bindString("app_id", context.appId)}
            AND timestamp >= ${baselineBindings.bindDateTime64("start_at", baselineStart)}
            AND timestamp <= ${baselineBindings.bindDateTime64("end_at", baselineEnd)}
        `,
          query_params: baselineBindings.query_params,
        }),
      ]);

      const currentRows = (await currentResult.json()) as unknown as Array<{
        total: number | string;
      }>;
      const baselineRows = (await baselineResult.json()) as unknown as Array<{
        total: number | string;
      }>;

      const current = Number(currentRows[0]?.total ?? 0);
      const baseline = Number(baselineRows[0]?.total ?? 0);
      const trend =
        baseline > 0
          ? ((current - baseline) / baseline) * 100
          : current > 0
            ? 100
            : 0;

      return ok({ total: current, trend });
    } catch (error) {
      recordError(error);
      logger.error("Failed to compute log trend", error as Error);
      return err("Failed to compute log trend.");
    }
  };

export { createGetLogsTrend };
