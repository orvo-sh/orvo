import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createQueryBindings } from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import {
  getLogServiceVolumeInputSchema,
  getLogVolumeInputSchema,
} from "../schema";
import { buildWhereClause } from "./shared";

const createGetLogVolume = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getLogVolumeInputSchema>,
  context: { appId: string },
) => {
    const validated = getLogVolumeInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bindings = createQueryBindings();
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const whereClause = buildWhereClause(bindings, context.appId, validated.data);

      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        WITH
          ${bindings.bindUInt64("start_ms", timeRange.startAtUtc.getTime())} AS start_ms,
          ${bindings.bindUInt64("bucket_ms", bucketSizeMs)} AS bucket_ms
        SELECT
          least(toInt32(intDiv(toUnixTimestamp64Milli(timestamp) - start_ms, bucket_ms)), toInt32(${bindings.bindUInt32("bucket_index_max", bucketCount - 1)})) AS bucket_index,
          countIf(lowerUTF8(severity_text) = 'fatal') AS fatal,
          countIf(lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS error,
          countIf(positionCaseInsensitiveUTF8(severity_text, 'warn') > 0) AS warn,
          countIf(lowerUTF8(severity_text) = 'debug' OR positionCaseInsensitiveUTF8(severity_text, 'debug') > 0) AS debug,
          countIf(lowerUTF8(severity_text) = 'trace') AS trace,
          countIf(
            lowerUTF8(severity_text) NOT IN ('fatal', 'trace')
            AND positionCaseInsensitiveUTF8(severity_text, 'err') = 0
            AND positionCaseInsensitiveUTF8(severity_text, 'warn') = 0
            AND positionCaseInsensitiveUTF8(severity_text, 'debug') = 0
          ) AS info,
          count() AS total
        FROM logs_raw
        WHERE ${whereClause}
        GROUP BY bucket_index
        ORDER BY bucket_index ASC
      `,
        query_params: bindings.query_params,
      });

      const rows = (await result.json()) as unknown as {
        bucket_index: number;
        fatal: number;
        error: number;
        warn: number;
        info: number;
        debug: number;
        trace: number;
        total: number;
      }[];

      const rowMap = new Map(rows.map((row) => [Number(row.bucket_index), row]));
      const buckets = Array.from({ length: bucketCount }, (_, index) => {
        const bucketStart = new Date(
          timeRange.startAtUtc.getTime() + index * bucketSizeMs,
        );
        const bucketEnd = new Date(
          Math.min(
            timeRange.startAtUtc.getTime() + (index + 1) * bucketSizeMs,
            timeRange.endAtUtc.getTime(),
          ),
        );
        const row = rowMap.get(index);

        return {
          startAtUtc: bucketStart.toISOString(),
          endAtUtc: bucketEnd.toISOString(),
          fatal: Number(row?.fatal ?? 0),
          error: Number(row?.error ?? 0),
          warn: Number(row?.warn ?? 0),
          info: Number(row?.info ?? 0),
          debug: Number(row?.debug ?? 0),
          trace: Number(row?.trace ?? 0),
          total: Number(row?.total ?? 0),
        };
      });

      return ok({ buckets });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch log volume", error as Error);
      return err("Failed to fetch log volume.");
    }
  };

const createGetLogServiceVolume = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getLogServiceVolumeInputSchema>,
  context: { appId: string },
) => {
    const validated = getLogServiceVolumeInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bindings = createQueryBindings();
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const whereClause = buildWhereClause(bindings, context.appId, validated.data);

      const result = await clickhouse.query({
        format: "JSONEachRow",
        query: `
        WITH
          ${bindings.bindUInt64("start_ms", timeRange.startAtUtc.getTime())} AS start_ms,
          ${bindings.bindUInt64("bucket_ms", bucketSizeMs)} AS bucket_ms
        SELECT
          service_name,
          least(toInt32(intDiv(toUnixTimestamp64Milli(timestamp) - start_ms, bucket_ms)), toInt32(${bindings.bindUInt32("bucket_index_max", bucketCount - 1)})) AS bucket_index,
          count() AS total,
          countIf(lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors
        FROM logs_raw
        WHERE ${whereClause}
        GROUP BY service_name, bucket_index
        ORDER BY service_name, bucket_index ASC
      `,
        query_params: bindings.query_params,
      });

      const rows = (await result.json()) as unknown as {
        service_name: string;
        bucket_index: number;
        total: number;
        errors: number;
      }[];

      const serviceMap = new Map<
        string,
        Map<
          number,
          {
            service_name: string;
            bucket_index: number;
            total: number;
            errors: number;
          }
        >
      >();

      for (const row of rows) {
        if (!serviceMap.has(row.service_name)) {
          serviceMap.set(row.service_name, new Map());
        }

        serviceMap.get(row.service_name)!.set(Number(row.bucket_index), row);
      }

      const services = Array.from(serviceMap.entries()).map(([name, bucketMap]) => {
        const buckets = Array.from({ length: bucketCount }, (_, index) => {
          const bucketStart = new Date(
            timeRange.startAtUtc.getTime() + index * bucketSizeMs,
          );
          const row = bucketMap.get(index);

          return {
            startAtUtc: bucketStart.toISOString(),
            total: Number(row?.total ?? 0),
            errors: Number(row?.errors ?? 0),
          };
        });

        return { name, buckets };
      });

      return ok({ services });
    } catch (error) {
      recordError(error);
      logger.error("Failed to fetch service volume", error as Error);
      return err("Failed to fetch service volume.");
    }
  };

export { createGetLogServiceVolume, createGetLogVolume };
