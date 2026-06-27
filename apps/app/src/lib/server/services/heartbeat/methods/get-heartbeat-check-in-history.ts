import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { quote, toDateTime64 } from "../../shared/query-builders";
import { getHeartbeatMonitorInputSchema } from "../schema";

const createGetHeartbeatCheckInHistory = ({
  db,
  clickhouse,
  logger,
}: {
  db: DB;
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getHeartbeatMonitorInputSchema>,
  context: { appId: string },
) => {
  const validated = getHeartbeatMonitorInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const monitor = await db.query.heartbeatMonitor.findFirst({
      where: and(
        eq(heartbeatMonitor.id, validated.data),
        eq(heartbeatMonitor.appId, context.appId),
      ),
    });

    if (!monitor) {
      return err("Heartbeat monitor not found.");
    }

    const rangeEndAt = new Date();
    const rangeStartAt = new Date(rangeEndAt.getTime() - 24 * 60 * 60 * 1000);
    const rangeSeconds = Math.max(
      Math.floor((rangeEndAt.getTime() - rangeStartAt.getTime()) / 1000),
      1,
    );
    const bucketSizeSeconds = Math.min(
      rangeSeconds,
      Math.max(monitor.expectedEverySeconds, Math.ceil(rangeSeconds / 48)),
    );
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const alignedStartAt = new Date(
      Math.floor(rangeStartAt.getTime() / bucketSizeMs) * bucketSizeMs,
    );

    const [bucketResult, recentResult] = await Promise.all([
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            toStartOfInterval(checked_in_at, INTERVAL ${bucketSizeSeconds} SECOND) AS bucket_start,
            count() AS total
          FROM heartbeat_checkins
          WHERE app_id = ${quote(context.appId)}
            AND heartbeat_monitor_id = ${quote(monitor.id)}
            AND checked_in_at >= ${toDateTime64(alignedStartAt)}
            AND checked_in_at <= ${toDateTime64(rangeEndAt)}
          GROUP BY bucket_start
          ORDER BY bucket_start ASC
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT checked_in_at
          FROM heartbeat_checkins
          WHERE app_id = ${quote(context.appId)}
            AND heartbeat_monitor_id = ${quote(monitor.id)}
          ORDER BY checked_in_at DESC
          LIMIT 20
        `,
      }),
    ]);
    const bucketRows = (await bucketResult.json()) as unknown as Array<{
      bucket_start: string;
      total: number | string;
    }>;
    const recentRows = (await recentResult.json()) as unknown as Array<{
      checked_in_at: string;
    }>;
    const totalsByBucket = new Map(
      bucketRows.map((row) => [
        new Date(row.bucket_start).getTime(),
        Number(row.total ?? 0),
      ]),
    );
    const buckets: Array<{
      startAt: Date;
      endAt: Date;
      count: number;
      status: "healthy" | "missed" | "grace";
    }> = [];

    for (
      let bucketStartMs = alignedStartAt.getTime();
      bucketStartMs <= rangeEndAt.getTime();
      bucketStartMs += bucketSizeMs
    ) {
      const startAt = new Date(bucketStartMs);
      const endAt = new Date(bucketStartMs + bucketSizeMs);
      const count = totalsByBucket.get(bucketStartMs) ?? 0;
      const status =
        count > 0
          ? "healthy"
          : endAt.getTime() + monitor.graceSeconds * 1000 < rangeEndAt.getTime()
            ? "missed"
            : "grace";

      buckets.push({
        startAt,
        endAt,
        count,
        status,
      });
    }

    const recentCheckIns = recentRows.map((row) => ({
      checkedInAt: new Date(row.checked_in_at),
    }));
    const ascendingCheckInTimes = recentCheckIns
      .slice()
      .reverse()
      .map((item) => item.checkedInAt.getTime());
    const intervals = ascendingCheckInTimes
      .slice(1)
      .map((time, index) => time - ascendingCheckInTimes[index]!)
      .filter((value) => value > 0);

    return ok({
      history: {
        rangeStartAt: alignedStartAt,
        rangeEndAt,
        bucketSizeSeconds,
        buckets,
        recentCheckIns,
        stats: {
          totalCheckIns24h: buckets.reduce(
            (total, bucket) => total + bucket.count,
            0,
          ),
          receivedBuckets24h: buckets.filter((bucket) => bucket.count > 0).length,
          missedBuckets24h: buckets.filter((bucket) => bucket.status === "missed")
            .length,
          averageIntervalSeconds:
            intervals.length > 0
              ? Math.round(
                intervals.reduce((total, value) => total + value, 0) /
                  intervals.length /
                  1000,
              )
              : null,
        },
      },
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load heartbeat history", error as Error);
    return err("Failed to load heartbeat history.");
  }
};

export { createGetHeartbeatCheckInHistory };
