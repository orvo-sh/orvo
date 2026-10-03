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
      const bindings = createQueryBindings();
      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            countIf(
              timestamp >= ${bindings.bindDateTime64("start_at", startAtUtc)}
              AND timestamp <= ${bindings.bindDateTime64("end_at", endAtUtc)}
            ) AS current,
            countIf(
              timestamp >= ${bindings.bindDateTime64("baseline_start", baselineStart)}
              AND timestamp <= ${bindings.bindDateTime64("baseline_end", baselineEnd)}
            ) AS baseline
          FROM logs_raw
          WHERE app_id = ${bindings.bindString("app_id", context.appId)}
            AND timestamp >= ${bindings.bindDateTime64("scan_start", baselineStart)}
            AND timestamp <= ${bindings.bindDateTime64("scan_end", endAtUtc)}
        `,
        query_params: bindings.query_params,
      });
      const [row] = (await result.json()) as unknown as Array<{
        current: number | string;
        baseline: number | string;
      }>;
      const current = Number(row?.current ?? 0);
      const baseline = Number(row?.baseline ?? 0);
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
