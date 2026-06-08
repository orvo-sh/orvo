import type { ClickHouseClient } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

class LogsService {
  private logger: Logger;

  constructor(
    private clickhouse: ClickHouseClient,
    logger: Logger,
  ) {
    this.logger = logger.child("LogsService");
  }

  async getLogs(
    input: z.infer<typeof getLogsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getLogs: fetching logs", { input, context });

    const validated = getLogsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const pageSize = validated.data.limit + 1;
      const whereClause = buildWhereClause(context.appId, validated.data, {
        cursor: validated.data.cursor,
      });
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					SELECT
						id,
						app_id,
						ingestion_key_id,
						received_at,
						expires_at,
						timestamp,
						observed_timestamp,
						severity_number,
						severity_text,
						body,
						trace_id,
						span_id,
						trace_flags,
						resource_attributes,
						resource_schema_url,
						scope_name,
						scope_version,
						scope_attributes,
						scope_schema_url,
						log_attributes,
						service_name,
						deployment_environment
					FROM logs_raw
					WHERE ${whereClause}
					ORDER BY timestamp DESC, id DESC
					LIMIT ${pageSize}
				`,
      });
      const rows = (await result.json()) as unknown as RawLogRow[];
      const hasNextPage = rows.length > validated.data.limit;
      const visibleRows = rows.slice(0, validated.data.limit).map((row) => ({
        ...row,
        received_at: normalizeDateTime(row.received_at),
        expires_at: normalizeDateTime(row.expires_at),
        timestamp: normalizeDateTime(row.timestamp),
        observed_timestamp: normalizeDateTime(row.observed_timestamp),
      }));
      const lastRow = visibleRows.at(-1);

      return ok({
        logs: visibleRows,
        nextCursor:
          hasNextPage && lastRow
            ? {
                id: lastRow.id,
                timestamp: lastRow.timestamp,
              }
            : null,
      });
    } catch (error) {
      this.logger.error("getLogs: failed to fetch logs", error as Error);
      return err("Failed to fetch logs.");
    }
  }

  async getLogVolume(
    input: z.infer<typeof getLogVolumeInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getLogVolume: fetching log volume", { input, context });

    const validated = getLogVolumeInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeRange(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const whereClause = buildWhereClause(context.appId, validated.data);
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					WITH
						${timeRange.startAtUtc.getTime()} AS start_ms,
						${bucketSizeMs} AS bucket_ms
					SELECT
						least(toInt32(intDiv(toUnixTimestamp64Milli(timestamp) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
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
      });
      const rows = (await result.json()) as unknown as RawVolumeRow[];
      const rowMap = new Map(rows.map((row) => [row.bucket_index, row]));
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
          fatal: row?.fatal ?? 0,
          error: row?.error ?? 0,
          warn: row?.warn ?? 0,
          info: row?.info ?? 0,
          debug: row?.debug ?? 0,
          trace: row?.trace ?? 0,
          total: row?.total ?? 0,
        };
      });

      return ok({ buckets });
    } catch (error) {
      this.logger.error(
        "getLogVolume: failed to fetch log volume",
        error as Error,
      );
      return err("Failed to fetch log volume.");
    }
  }

  async getLogServiceVolume(
    input: z.infer<typeof getLogServiceVolumeInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getLogServiceVolume: fetching service volume", {
      input,
      context,
    });

    const validated = getLogServiceVolumeInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeRange(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const whereClause = buildWhereClause(context.appId, validated.data);
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					WITH
						${timeRange.startAtUtc.getTime()} AS start_ms,
						${bucketSizeMs} AS bucket_ms
					SELECT
						service_name,
						least(toInt32(intDiv(toUnixTimestamp64Milli(timestamp) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
						count() AS total,
						countIf(lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors
					FROM logs_raw
					WHERE ${whereClause}
					GROUP BY service_name, bucket_index
					ORDER BY service_name, bucket_index ASC
				`,
      });
      const rows = (await result.json()) as unknown as RawServiceVolumeRow[];

      const serviceMap = new Map<string, Map<number, RawServiceVolumeRow>>();
      for (const row of rows) {
        if (!serviceMap.has(row.service_name)) {
          serviceMap.set(row.service_name, new Map());
        }
        serviceMap.get(row.service_name)!.set(row.bucket_index, row);
      }

      const services = Array.from(serviceMap.entries()).map(
        ([name, bucketMap]) => {
          const buckets = Array.from({ length: bucketCount }, (_, index) => {
            const bucketStart = new Date(
              timeRange.startAtUtc.getTime() + index * bucketSizeMs,
            );
            const row = bucketMap.get(index);

            return {
              startAtUtc: bucketStart.toISOString(),
              total: row?.total ?? 0,
              errors: row?.errors ?? 0,
            };
          });

          return { name, buckets };
        },
      );

      return ok({ services });
    } catch (error) {
      this.logger.error(
        "getLogServiceVolume: failed to fetch service volume",
        error as Error,
      );
      return err("Failed to fetch service volume.");
    }
  }

  async getLogServiceSummary(
    input: z.infer<typeof getLogServiceSummaryInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getLogServiceSummary: fetching service summary", {
      input,
      context,
    });

    const validated = getLogServiceSummaryInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeRange(validated.data.time);
      const whereClause = buildWhereClause(context.appId, {
        time: validated.data.time,
        search: "",
        levels: [],
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
      });
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					SELECT
						service_name,
						count() AS total,
						countIf(lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors,
						max(timestamp) AS last_seen
					FROM logs_raw
					WHERE ${whereClause}
					GROUP BY service_name
					ORDER BY total DESC
					LIMIT 20
				`,
      });
      const rows = (await result.json()) as unknown as RawServiceSummaryRow[];

      return ok({
        services: rows.map((row) => ({
          name: row.service_name,
          total: Number(row.total),
          errors: Number(row.errors),
          lastSeen: normalizeDateTime(row.last_seen),
        })),
        startAtUtc: startAtUtc.toISOString(),
        endAtUtc: endAtUtc.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        "getLogServiceSummary: failed to fetch service summary",
        error as Error,
      );
      return err("Failed to fetch service summary.");
    }
  }
}

const logTimePresetValues = [
  "last_hour",
  "today",
  "last_24_hours",
  "last_3_days",
  "last_7_days",
  "last_2_weeks",
  "last_month",
] as const;

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

export const logTimePresetSchema = z.enum(logTimePresetValues);

export const logTimeFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("preset"),
    preset: logTimePresetSchema,
  }),
  z
    .object({
      kind: z.literal("range"),
      startAtUtc: z.string().datetime({ offset: true }),
      endAtUtc: z.string().datetime({ offset: true }),
    })
    .refine(
      (value) =>
        new Date(value.startAtUtc).getTime() <=
        new Date(value.endAtUtc).getTime(),
      {
        message: "startAtUtc must be less than or equal to endAtUtc",
        path: ["endAtUtc"],
      },
    ),
]);

export const logsQueryFiltersSchema = z.object({
  time: logTimeFilterSchema,
  search: z.string().trim().max(500).default(""),
  levels: stringArrayFilterSchema,
  services: stringArrayFilterSchema,
  environments: stringArrayFilterSchema,
  scopes: stringArrayFilterSchema,
  ingestionKeyIds: stringArrayFilterSchema,
  traceId: z.string().trim().max(255).optional(),
  spanId: z.string().trim().max(255).optional(),
});

export const logsCursorSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  id: z.string().trim().min(1).max(255),
});

export const getLogsInputSchema = logsQueryFiltersSchema.extend({
  limit: z.number().int().min(1).max(500).default(100),
  cursor: logsCursorSchema.optional(),
});

export const getLogVolumeInputSchema = logsQueryFiltersSchema.extend({
  bucketCount: z.number().int().min(10).max(240).default(80),
});

export const getLogServiceSummaryInputSchema = z.object({
  time: logTimeFilterSchema,
});

export const getLogServiceVolumeInputSchema = logsQueryFiltersSchema.extend({
  bucketCount: z.number().int().min(5).max(240).default(20),
});

export type LogsOmitFacet =
  | "levels"
  | "services"
  | "environments"
  | "scopes"
  | "ingestionKeyIds";

type RawLogRow = {
  id: string;
  app_id: string;
  ingestion_key_id: string;
  received_at: string | Date;
  expires_at: string | Date;
  timestamp: string | Date;
  observed_timestamp: string | Date;
  severity_number: number;
  severity_text: string;
  body: string;
  trace_id: string;
  span_id: string;
  trace_flags: number;
  resource_attributes: Record<string, string>;
  resource_schema_url: string;
  scope_name: string;
  scope_version: string;
  scope_attributes: Record<string, string>;
  scope_schema_url: string;
  log_attributes: Record<string, string>;
  service_name: string;
  deployment_environment: string;
};

type RawVolumeRow = {
  bucket_index: number;
  fatal: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  trace: number;
  total: number;
};

type RawServiceSummaryRow = {
  service_name: string;
  total: number | string;
  errors: number | string;
  last_seen: string | Date;
};

type RawServiceVolumeRow = {
  service_name: string;
  bucket_index: number;
  total: number;
  errors: number;
};

const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) =>
  `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value.includes("T")) {
    return value.endsWith("Z") ? value : `${value}Z`;
  }

  return `${value.replace(" ", "T")}Z`;
};

const buildInClause = (column: string, values: string[]) =>
  `${column} IN (${values.map((value) => quote(value)).join(", ")})`;

const resolveTimeRange = (time: z.infer<typeof logTimeFilterSchema>) => {
  const endAtUtc = new Date();

  if (time.kind === "range") {
    return {
      startAtUtc: new Date(time.startAtUtc),
      endAtUtc: new Date(time.endAtUtc),
    };
  }

  if (time.preset === "today") {
    const startAtToday = new Date(endAtUtc);
    startAtToday.setUTCHours(0, 0, 0, 0);
    return {
      startAtUtc: startAtToday,
      endAtUtc,
    };
  }

  const presetMinutesMap: Record<(typeof logTimePresetValues)[number], number> =
    {
      last_hour: 60,
      today: 0,
      last_24_hours: 60 * 24,
      last_3_days: 60 * 24 * 3,
      last_7_days: 60 * 24 * 7,
      last_2_weeks: 60 * 24 * 14,
      last_month: 60 * 24 * 30,
    };

  return {
    startAtUtc: new Date(
      endAtUtc.getTime() - presetMinutesMap[time.preset] * 60 * 1000,
    ),
    endAtUtc,
  };
};

const buildWhereClause = (
  appId: string,
  input: z.infer<typeof logsQueryFiltersSchema>,
  options?: {
    omitFacet?: LogsOmitFacet;
    cursor?: z.infer<typeof logsCursorSchema>;
  },
) => {
  const { startAtUtc, endAtUtc } = resolveTimeRange(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `timestamp >= ${toDateTime64(startAtUtc)}`,
    `timestamp <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.search) {
    whereClauses.push(
      `positionCaseInsensitiveUTF8(body, ${quote(input.search)}) > 0`,
    );
  }

  if (input.levels.length > 0 && options?.omitFacet !== "levels") {
    whereClauses.push(buildInClause("severity_text", input.levels));
  }

  if (input.services.length > 0 && options?.omitFacet !== "services") {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0 && options?.omitFacet !== "environments") {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  if (input.scopes.length > 0 && options?.omitFacet !== "scopes") {
    whereClauses.push(buildInClause("scope_name", input.scopes));
  }

  if (
    input.ingestionKeyIds.length > 0 &&
    options?.omitFacet !== "ingestionKeyIds"
  ) {
    whereClauses.push(buildInClause("ingestion_key_id", input.ingestionKeyIds));
  }

  if (input.traceId) {
    whereClauses.push(`trace_id = ${quote(input.traceId)}`);
  }

  if (input.spanId) {
    whereClauses.push(`span_id = ${quote(input.spanId)}`);
  }

  if (options?.cursor) {
    whereClauses.push(
      `(timestamp < ${toDateTime64(new Date(options.cursor.timestamp))} OR (timestamp = ${toDateTime64(new Date(options.cursor.timestamp))} AND id < ${quote(options.cursor.id)}))`,
    );
  }

  return whereClauses.join(" AND ");
};

export { buildWhereClause, LogsService, resolveTimeRange };
