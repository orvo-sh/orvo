import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import { resolveTimeFilter, timeFilterSchema } from "../shared/time-filter";

@Instrument({ prefix: "traces" })
class TracesService {
  private logger: Logger;

  constructor(
    private clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("TracesService");
  }

  async getTotalTraces(
    input: z.input<typeof getTotalTracesInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTotalTraces: fetching total traces", {
      input,
      context,
    });

    const validated = getTotalTracesInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT uniqExact(trace_id) AS total
          FROM traces_raw
          WHERE app_id = ${quote(context.appId)}
            AND start_time >= ${toDateTime64(startAtUtc)}
            AND start_time <= ${toDateTime64(endAtUtc)}
        `,
      });
      const rows = (await result.json()) as unknown as Array<{
        total: number | string;
      }>;
      return ok({ total: Number(rows[0]?.total ?? 0) });
    } catch (error) {
      this.logger.error(
        "getTotalTraces: failed to fetch total traces",
        error as Error,
      );
      return err("Failed to fetch total traces.");
    }
  }

  async getTracesTrend(
    input: z.input<typeof getTotalTracesInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTracesTrend: computing trace trend", {
      input,
      context,
    });

    const validated = getTotalTracesInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const rangeMs = endAtUtc.getTime() - startAtUtc.getTime();
      const baselineStart = new Date(startAtUtc.getTime() - rangeMs);
      const baselineEnd = startAtUtc;

      const [currentResult, baselineResult] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT uniqExact(trace_id) AS total
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
              AND start_time >= ${toDateTime64(startAtUtc)}
              AND start_time <= ${toDateTime64(endAtUtc)}
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT uniqExact(trace_id) AS total
            FROM traces_raw
            WHERE app_id = ${quote(context.appId)}
              AND start_time >= ${toDateTime64(baselineStart)}
              AND start_time <= ${toDateTime64(baselineEnd)}
          `,
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
      this.logger.error(
        "getTracesTrend: failed to compute trace trend",
        error as Error,
      );
      return err("Failed to compute trace trend.");
    }
  }

  async getTraces(
    input: z.input<typeof getTracesInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTraces: fetching traces", { input, context });

    const validated = getTracesInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const pageSize = validated.data.limit + 1;
      const whereClause = buildWhereClause(context.appId, validated.data);

      const outerWhereClauses = [];
      if (validated.data.cursor) {
        outerWhereClauses.push(
          `(trace_start_time < ${toDateTime64(new Date(validated.data.cursor.startTime))} OR (trace_start_time = ${toDateTime64(new Date(validated.data.cursor.startTime))} AND trace_id < ${quote(validated.data.cursor.traceId)}))`,
        );
      }
      for (const condition of validated.data.conditions) {
        const clause = buildOuterConditionClause(condition);
        if (clause) {
          outerWhereClauses.push(clause);
        }
      }
      if (validated.data.operations.length > 0) {
        outerWhereClauses.push(
          buildInClause("name", validated.data.operations),
        );
      }
      if (validated.data.traceIds.length > 0) {
        outerWhereClauses.push(
          buildInClause("trace_id", validated.data.traceIds),
        );
      }
      if (validated.data.statuses.length === 1) {
        outerWhereClauses.push(
          validated.data.statuses[0] === "error"
            ? "error_count > 0"
            : "error_count = 0",
        );
      }
      if (validated.data.minDurationNs !== undefined) {
        outerWhereClauses.push(
          `duration_ns >= ${validated.data.minDurationNs}`,
        );
      }
      if (validated.data.maxDurationNs !== undefined) {
        outerWhereClauses.push(
          `duration_ns <= ${validated.data.maxDurationNs}`,
        );
      }
      const outerWhere =
        outerWhereClauses.length > 0
          ? `WHERE ${outerWhereClauses.join(" AND ")}`
          : "";

      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					SELECT
						trace_id,
						name,
						trace_start_time AS start_time,
						trace_end_time AS end_time,
						duration_ns,
						span_count,
						error_count,
						service_names,
						deployment_environments
					FROM (
						SELECT
							trace_id,
							coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS name,
							min(start_time) AS trace_start_time,
							max(end_time) AS trace_end_time,
							toInt64(toUnixTimestamp64Nano(max(end_time)) - toUnixTimestamp64Nano(min(start_time))) AS duration_ns,
							count() AS span_count,
							countIf(status_code = 2) AS error_count,
							arrayFilter(value -> value != '', groupUniqArray(service_name)) AS service_names,
							arrayFilter(value -> value != '', groupUniqArray(deployment_environment)) AS deployment_environments
						FROM traces_raw
						WHERE ${whereClause}
						GROUP BY trace_id
					)
					${outerWhere}
					ORDER BY trace_start_time DESC, trace_id DESC
					LIMIT ${pageSize}
				`,
      });
      const rows = (await result.json()) as unknown as RawTraceRow[];
      const hasNextPage = rows.length > validated.data.limit;
      const visibleRows = rows.slice(0, validated.data.limit).map((row) => ({
        ...row,
        start_time: normalizeDateTime(row.start_time),
        end_time: normalizeDateTime(row.end_time),
      }));
      const lastRow = visibleRows.at(-1);

      return ok({
        traces: visibleRows,
        nextCursor:
          hasNextPage && lastRow
            ? {
                startTime: lastRow.start_time,
                traceId: lastRow.trace_id,
              }
            : null,
      });
    } catch (error) {
      this.logger.error("getTraces: failed to fetch traces", error as Error);
      return err("Failed to fetch traces.");
    }
  }

  async getTraceFilterAttributes(context: { appId: string }) {
    this.logger.info(
      "getTraceFilterAttributes: fetching trace filter attributes",
      {
        context,
      },
    );

    try {
      const [resourceResult, scopeResult, spanResult] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(resource_attributes)) AS key
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(scope_attributes)) AS key
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT key, count() AS count
            FROM (
              SELECT arrayJoin(mapKeys(span_attributes)) AS key
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
            )
            WHERE key != ''
            GROUP BY key
            ORDER BY count DESC, key ASC
          `,
        }),
      ]);

      const resourceKeys =
        (await resourceResult.json()) as unknown as RawAttributeKeyRow[];
      const scopeKeys =
        (await scopeResult.json()) as unknown as RawAttributeKeyRow[];
      const spanKeys =
        (await spanResult.json()) as unknown as RawAttributeKeyRow[];

      return ok({
        attributes: [
          ...traceSearchBaseAttributes,
          ...resourceKeys.map((row) =>
            createDynamicTraceFilterAttribute("resource", row.key),
          ),
          ...scopeKeys.map((row) =>
            createDynamicTraceFilterAttribute("scope", row.key),
          ),
          ...spanKeys.map((row) =>
            createDynamicTraceFilterAttribute("span", row.key),
          ),
        ],
      });
    } catch (error) {
      this.logger.error(
        "getTraceFilterAttributes: failed to fetch trace filter attributes",
        error as Error,
      );
      return err("Failed to fetch trace filter attributes.");
    }
  }

  async getTraceFilterValueSuggestions(
    input: z.input<typeof getTraceFilterValueSuggestionsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "getTraceFilterValueSuggestions: fetching trace filter values",
      {
        input,
        context,
      },
    );

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
            .filter((value: string) =>
              query ? value.toLowerCase().includes(query.toLowerCase()) : true,
            )
            .slice(0, validated.data.limit)
            .map((value: string) => ({ value, count: 0 })),
        });
      }

      if (definition.kind === "duration") {
        return ok({
          values: traceDurationSuggestionValues
            .filter((value: string) =>
              query ? value.toLowerCase().includes(query.toLowerCase()) : true,
            )
            .slice(0, validated.data.limit)
            .map((value: string) => ({ value, count: 0 })),
        });
      }

      const result = await this.clickhouse.query({
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
      this.logger.error(
        "getTraceFilterValueSuggestions: failed to fetch trace filter values",
        error as Error,
      );
      return err("Failed to fetch trace filter values.");
    }
  }

  async getTraceSummary(
    input: z.input<typeof getTraceSummaryInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTraceSummary: fetching trace summary", {
      input,
      context,
    });

    const validated = getTraceSummaryInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const whereClause = buildTraceSummaryWhereClause(
        context.appId,
        validated.data,
      );
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					SELECT
						uniqExact(trace_id) AS total,
						uniqExactIf(trace_id, status_code = 2) AS error_traces,
						quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms,
						uniqExact(service_name) AS service_count
					FROM traces_raw
					WHERE ${whereClause}
				`,
      });
      const rows = (await result.json()) as unknown as RawTraceSummaryRow[];
      const row = rows[0];
      const total = Number(row?.total ?? 0);
      const errorTraces = Number(row?.error_traces ?? 0);

      return ok({
        total,
        errorTraces,
        errorRate: total > 0 ? errorTraces / total : 0,
        p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
        serviceCount: Number(row?.service_count ?? 0),
        startAtUtc: startAtUtc.toISOString(),
        endAtUtc: endAtUtc.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        "getTraceSummary: failed to fetch trace summary",
        error as Error,
      );
      return err("Failed to fetch trace summary.");
    }
  }

  async getTraceMetrics(
    input: z.input<typeof getTraceMetricsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTraceMetrics: fetching trace metrics", {
      input,
      context,
    });

    const validated = getTraceMetricsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const baselineStart = new Date(timeRange.startAtUtc.getTime() - rangeMs);
      const baselineEnd = timeRange.startAtUtc;
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);

      const [bucketResult, currentSummaryResult, baselineSummaryResult] =
        await Promise.all([
          this.clickhouse.query({
            format: "JSONEachRow",
            query: `
              WITH
                ${timeRange.startAtUtc.getTime()} AS start_ms,
                ${bucketSizeMs} AS bucket_ms
              SELECT
                least(toInt32(intDiv(toUnixTimestamp64Milli(start_time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
                count() AS total,
                countIf(status_code = 2) AS errors,
                quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
                AND start_time >= ${toDateTime64(timeRange.startAtUtc)}
                AND start_time <= ${toDateTime64(timeRange.endAtUtc)}
              GROUP BY bucket_index
              ORDER BY bucket_index ASC
            `,
          }),
          this.clickhouse.query({
            format: "JSONEachRow",
            query: `
              SELECT
                count() AS total,
                countIf(status_code = 2) AS errors,
                quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
                AND start_time >= ${toDateTime64(timeRange.startAtUtc)}
                AND start_time <= ${toDateTime64(timeRange.endAtUtc)}
            `,
          }),
          this.clickhouse.query({
            format: "JSONEachRow",
            query: `
              SELECT
                count() AS total,
                countIf(status_code = 2) AS errors,
                quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
              FROM traces_raw
              WHERE app_id = ${quote(context.appId)}
                AND start_time >= ${toDateTime64(baselineStart)}
                AND start_time <= ${toDateTime64(baselineEnd)}
            `,
          }),
        ]);

      const rows = (await bucketResult.json()) as unknown as {
        bucket_index: number;
        total: number;
        errors: number;
        p95_latency_ms: number;
      }[];
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
        const total = Number(row?.total ?? 0);
        const errors = Number(row?.errors ?? 0);

        return {
          startAtUtc: bucketStart.toISOString(),
          endAtUtc: bucketEnd.toISOString(),
          total,
          errors,
          errorRate: total > 0 ? errors / total : 0,
          p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
        };
      });

      const [currentSummaryRow] =
        (await currentSummaryResult.json()) as unknown as RawTraceMetricSummaryRow[];
      const [baselineSummaryRow] =
        (await baselineSummaryResult.json()) as unknown as RawTraceMetricSummaryRow[];

      const toSummary = (row: RawTraceMetricSummaryRow | undefined) => {
        const total = Number(row?.total ?? 0);
        const errors = Number(row?.errors ?? 0);

        return {
          total,
          errors,
          errorRate: total > 0 ? errors / total : 0,
          p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
        };
      };

      return ok({
        buckets,
        summary: toSummary(currentSummaryRow),
        baselineSummary: toSummary(baselineSummaryRow),
      });
    } catch (error) {
      this.logger.error(
        "getTraceMetrics: failed to fetch trace metrics",
        error as Error,
      );
      return err("Failed to fetch trace metrics.");
    }
  }

  async getTraceServiceSummary(
    input: z.infer<typeof getTraceServiceSummaryInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTraceServiceSummary: fetching service summary", {
      input,
      context,
    });

    const validated = getTraceServiceSummaryInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const whereClauses = [
        `app_id = ${quote(context.appId)}`,
        `start_time >= ${toDateTime64(startAtUtc)}`,
        `start_time <= ${toDateTime64(endAtUtc)}`,
      ];

      const bucketCount = 15;
      const rangeMs = Math.max(endAtUtc.getTime() - startAtUtc.getTime(), 1);
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);

      const [summaryResult, bucketResult] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              service_name,
              count() AS total,
              countIf(status_code = 2) AS errors,
              quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
            FROM traces_raw
            WHERE ${whereClauses.join(" AND ")}
            GROUP BY service_name
            ORDER BY total DESC
            LIMIT 20
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            WITH
              ${startAtUtc.getTime()} AS start_ms,
              ${bucketSizeMs} AS bucket_ms
            SELECT
              service_name,
              least(toInt32(intDiv(toUnixTimestamp64Milli(start_time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
              count() AS total
            FROM traces_raw
            WHERE ${whereClauses.join(" AND ")}
            GROUP BY service_name, bucket_index
            ORDER BY service_name, bucket_index ASC
          `,
        }),
      ]);

      const rows =
        (await summaryResult.json()) as unknown as RawTraceServiceSummaryRow[];
      const bucketRows = (await bucketResult.json()) as unknown as {
        service_name: string;
        bucket_index: number;
        total: number | string;
      }[];

      const bucketMap = new Map<string, number[]>();
      for (const row of bucketRows) {
        const name = row.service_name;
        const index = Number(row.bucket_index);
        const total = Number(row.total);
        if (!bucketMap.has(name)) {
          bucketMap.set(
            name,
            Array.from({ length: bucketCount }, () => 0),
          );
        }
        const arr = bucketMap.get(name)!;
        arr[index] = (arr[index] ?? 0) + total;
      }

      return ok({
        services: rows.map((row) => ({
          name: row.service_name,
          total: Number(row.total),
          errors: Number(row.errors),
          errorRate:
            Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
          p95LatencyMs: Number(row.p95_latency_ms ?? 0),
          buckets: bucketMap.get(row.service_name) ?? [],
        })),
        startAtUtc: startAtUtc.toISOString(),
        endAtUtc: endAtUtc.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        "getTraceServiceSummary: failed to fetch service summary",
        error as Error,
      );
      return err("Failed to fetch service summary.");
    }
  }

  async getServiceGraph(
    input: z.infer<typeof getServiceGraphInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getServiceGraph: fetching service graph", {
      input,
      context,
    });

    const validated = getServiceGraphInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const whereClauses = [
        `app_id = ${quote(context.appId)}`,
        `start_time >= ${toDateTime64(startAtUtc)}`,
        `start_time <= ${toDateTime64(endAtUtc)}`,
      ];

      const edgesResult = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            a.service_name AS source,
            b.service_name AS target,
            count() AS total,
            countIf(b.status_code = 2) AS errors
          FROM traces_raw AS a
          INNER JOIN traces_raw AS b
            ON a.trace_id = b.trace_id AND a.span_id = b.parent_span_id
          WHERE ${whereClauses.join(" AND ")}
            AND a.service_name != b.service_name
          GROUP BY source, target
          ORDER BY total DESC
          LIMIT 100
        `,
      });
      const edgeRows =
        (await edgesResult.json()) as unknown as RawServiceGraphEdgeRow[];

      const nodesResult = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            service_name,
            count() AS total,
            countIf(status_code = 2) AS errors,
            quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
          FROM traces_raw
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY service_name
          ORDER BY total DESC
          LIMIT 50
        `,
      });
      const nodeRows =
        (await nodesResult.json()) as unknown as RawServiceGraphNodeRow[];

      const nodes = nodeRows.map((row) => ({
        name: row.service_name,
        total: Number(row.total),
        errors: Number(row.errors),
        errorRate:
          Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
        p95LatencyMs: Number(row.p95_latency_ms ?? 0),
      }));

      const edges = edgeRows.map((row) => ({
        source: row.source,
        target: row.target,
        total: Number(row.total),
        errors: Number(row.errors),
        errorRate:
          Number(row.total) > 0 ? Number(row.errors) / Number(row.total) : 0,
      }));

      return ok({
        nodes,
        edges,
        startAtUtc: startAtUtc.toISOString(),
        endAtUtc: endAtUtc.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        "getServiceGraph: failed to fetch service graph",
        error as Error,
      );
      return err("Failed to fetch service graph.");
    }
  }

  async getTrace(
    input: z.infer<typeof getTraceInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTrace: fetching trace", { input, context });

    const validated = getTraceInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
					SELECT
						id,
						app_id,
						ingestion_key_id,
						received_at,
						expires_at,
						trace_id,
						span_id,
						parent_span_id,
						trace_state,
						name,
						kind,
						start_time,
						end_time,
						duration_ns,
						status_code,
						status_message,
						resource_attributes,
						scope_attributes,
						span_attributes,
						resource_schema_url,
						scope_name,
						scope_version,
						scope_schema_url,
						events_json,
						links_json,
						service_name,
						deployment_environment
					FROM traces_raw
					WHERE app_id = ${quote(context.appId)}
						AND trace_id = ${quote(validated.data.traceId)}
					ORDER BY start_time ASC
				`,
      });
      const spans = ((await result.json()) as unknown as RawSpanRow[]).map(
        (row) => ({
          ...row,
          received_at: normalizeDateTime(row.received_at),
          expires_at: normalizeDateTime(row.expires_at),
          start_time: normalizeDateTime(row.start_time),
          end_time: normalizeDateTime(row.end_time),
        }),
      );

      return ok({ spans });
    } catch (error) {
      this.logger.error("getTrace: failed to fetch trace", error as Error);
      return err("Failed to fetch trace.");
    }
  }
}

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const statusCodeFilterSchema = z
  .array(z.number().int().min(0).max(255))
  .max(10)
  .default([]);

const traceStatusFilterSchema = z
  .array(z.enum(["ok", "error"]))
  .max(10)
  .default([]);

export const traceFilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
]);

export const traceFilterConditionSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: traceFilterOperatorSchema,
  value: z.string().trim().min(1).max(2000),
});

export const tracesCursorSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  traceId: z.string().trim().min(1).max(255),
});

export const tracesQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  search: z.string().trim().max(500).optional().default(""),
  services: stringArrayFilterSchema.optional().default([]),
  environments: stringArrayFilterSchema.optional().default([]),
  scopes: stringArrayFilterSchema.optional().default([]),
  ingestionKeyIds: stringArrayFilterSchema.optional().default([]),
  statusCodes: statusCodeFilterSchema.optional().default([]),
  statuses: traceStatusFilterSchema.optional().default([]),
  operations: stringArrayFilterSchema.optional().default([]),
  traceIds: stringArrayFilterSchema.optional().default([]),
  conditions: z
    .array(traceFilterConditionSchema)
    .max(50)
    .optional()
    .default([]),
  minDurationNs: z.number().min(0).optional(),
  maxDurationNs: z.number().min(0).optional(),
});

export const getTracesInputSchema = tracesQueryFiltersSchema.extend({
  limit: z.number().int().min(1).max(500).default(100),
  cursor: tracesCursorSchema.optional(),
});

export const getTraceInputSchema = z.object({
  traceId: z.string().trim().min(1).max(255),
});

export const getTraceSummaryInputSchema = tracesQueryFiltersSchema;

export const getTotalTracesInputSchema = z.object({
  time: timeFilterSchema,
});

export const getTraceServiceSummaryInputSchema = z.object({
  time: timeFilterSchema,
});

export const getTraceMetricsInputSchema = z.object({
  time: timeFilterSchema,
  bucketCount: z.number().int().min(10).max(240).default(60),
});

export const getServiceGraphInputSchema = z.object({
  time: timeFilterSchema,
});

export const getTraceFilterValueSuggestionsInputSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: traceFilterOperatorSchema.optional(),
  query: z.string().trim().max(500).optional().default(""),
  limit: z.number().int().min(1).max(100).default(12),
});

const traceStringOperators = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
] satisfies z.infer<typeof traceFilterOperatorSchema>[];

const traceDurationOperators = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
] satisfies z.infer<typeof traceFilterOperatorSchema>[];

const traceStatusOperators = ["eq", "neq", "in", "not_in"] satisfies z.infer<
  typeof traceFilterOperatorSchema
>[];

const traceDurationSuggestionValues = [
  "10ms",
  "50ms",
  "100ms",
  "250ms",
  "500ms",
  "1s",
  "2s",
  "5s",
  "10s",
] as const;

const traceSearchBaseAttributes = [
  {
    key: "trace.id",
    label: "trace.id",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "trace.name",
    label: "trace.name",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "trace.status",
    label: "trace.status",
    source: "trace",
    type: "enum",
    availableOperators: traceStatusOperators,
    isCommon: true,
  },
  {
    key: "trace.duration",
    label: "trace.duration",
    source: "trace",
    type: "duration",
    availableOperators: traceDurationOperators,
  },
  {
    key: "service.name",
    label: "service.name",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "deployment.environment",
    label: "deployment.environment",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "scope.name",
    label: "scope.name",
    source: "scope",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "scope.version",
    label: "scope.version",
    source: "scope",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "status.message",
    label: "status.message",
    source: "span",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "ingestion_key_id",
    label: "ingestion_key_id",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
  },
] as const;

type RawServiceGraphEdgeRow = {
  source: string;
  target: string;
  total: number | string;
  errors: number | string;
};

type RawServiceGraphNodeRow = {
  service_name: string;
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawTraceServiceSummaryRow = {
  service_name: string;
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawTraceSummaryRow = {
  total: number | string;
  error_traces: number | string;
  p95_latency_ms: number | string;
  service_count: number | string;
};

type RawTraceMetricSummaryRow = {
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawAttributeKeyRow = {
  key: string;
  count: number | string;
};

type RawFilterValueRow = {
  value: string;
  count: number | string;
};

type RawTraceRow = {
  trace_id: string;
  name: string;
  start_time: string | Date;
  end_time: string | Date;
  duration_ns: number | string;
  span_count: number | string;
  error_count: number | string;
  service_names: string[];
  deployment_environments: string[];
};

type RawSpanRow = {
  id: string;
  app_id: string;
  ingestion_key_id: string;
  received_at: string | Date;
  expires_at: string | Date;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  trace_state: string;
  name: string;
  kind: number;
  start_time: string | Date;
  end_time: string | Date;
  duration_ns: number | string;
  status_code: number;
  status_message: string;
  resource_attributes: Record<string, string>;
  scope_attributes: Record<string, string>;
  span_attributes: Record<string, string>;
  resource_schema_url: string;
  scope_name: string;
  scope_version: string;
  scope_schema_url: string;
  events_json: string;
  links_json: string;
  service_name: string;
  deployment_environment: string;
};

const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const createDynamicTraceFilterAttribute = (
  source: "resource" | "scope" | "span",
  key: string,
) => ({
  key: `${source}.${key}`,
  label: `${source}.${key}`,
  source,
  type: "string" as const,
  availableOperators: traceStringOperators,
});

const resolveTraceFilterAttributeDefinition = (attribute: string) => {
  const staticAttribute = traceSearchBaseAttributes.find(
    (value) => value.key === attribute,
  );
  if (staticAttribute) {
    return {
      ...staticAttribute,
      kind:
        staticAttribute.key === "trace.status"
          ? ("enum" as const)
          : staticAttribute.key === "trace.duration"
            ? ("duration" as const)
            : ("column" as const),
      column:
        staticAttribute.key === "trace.id"
          ? "trace_id"
          : staticAttribute.key === "trace.name"
            ? "name"
            : staticAttribute.key === "service.name"
              ? "service_name"
              : staticAttribute.key === "deployment.environment"
                ? "deployment_environment"
                : staticAttribute.key === "scope.name"
                  ? "scope_name"
                  : staticAttribute.key === "scope.version"
                    ? "scope_version"
                    : staticAttribute.key === "status.message"
                      ? "status_message"
                      : staticAttribute.key === "ingestion_key_id"
                        ? "ingestion_key_id"
                        : undefined,
      scope:
        staticAttribute.key === "trace.id" ||
        staticAttribute.key === "trace.name" ||
        staticAttribute.key === "trace.status" ||
        staticAttribute.key === "trace.duration"
          ? ("outer" as const)
          : ("inner" as const),
    };
  }

  if (attribute.startsWith("resource.")) {
    return {
      ...createDynamicTraceFilterAttribute("resource", attribute.slice(9)),
      mapColumn: "resource_attributes" as const,
      mapKey: attribute.slice(9),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  if (attribute.startsWith("scope.")) {
    if (attribute === "scope.name" || attribute === "scope.version") {
      return null;
    }

    return {
      ...createDynamicTraceFilterAttribute("scope", attribute.slice(6)),
      mapColumn: "scope_attributes" as const,
      mapKey: attribute.slice(6),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  if (attribute.startsWith("span.")) {
    if (attribute === "span.kind") {
      return null;
    }

    return {
      ...createDynamicTraceFilterAttribute("span", attribute.slice(5)),
      mapColumn: "span_attributes" as const,
      mapKey: attribute.slice(5),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  return null;
};

const parseDurationLiteralToNs = (value: string) => {
  const match = value.match(/^([\d.]+)\s*(ms|s|m|h|µs|us|ns)?$/i);
  if (!match) {
    return undefined;
  }

  const num = Number.parseFloat(match[1]);
  const unit = match[2]?.toLowerCase() ?? "ms";

  switch (unit) {
    case "ns":
      return num;
    case "µs":
    case "us":
      return num * 1_000;
    case "ms":
      return num * 1_000_000;
    case "s":
      return num * 1_000_000_000;
    case "m":
      return num * 60_000_000_000;
    case "h":
      return num * 3_600_000_000_000;
    default:
      return num * 1_000_000;
  }
};

const parseMultiValueLiteral = (value: string) =>
  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const buildStringOperatorClause = (
  expression: string,
  operator: z.infer<typeof traceFilterOperatorSchema>,
  value: string,
) => {
  switch (operator) {
    case "eq":
      return `${expression} = ${quote(value)}`;
    case "neq":
      return `${expression} != ${quote(value)}`;
    case "contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${quote(value)}) > 0`;
    case "not_contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${quote(value)}) = 0`;
    case "in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return `${expression} IN (${values.map((item) => quote(item)).join(", ")})`;
    }
    case "not_in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return `${expression} NOT IN (${values.map((item) => quote(item)).join(", ")})`;
    }
    default:
      return null;
  }
};

const buildAnySearchClause = (value: string) =>
  `(positionCaseInsensitiveUTF8(name, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(trace_id, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(status_message, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(service_name, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(deployment_environment, ${quote(value)}) > 0)`;

const buildInnerConditionClause = (
  condition: z.infer<typeof traceFilterConditionSchema>,
) => {
  const definition = resolveTraceFilterAttributeDefinition(condition.attribute);
  if (!definition || definition.scope !== "inner") {
    return null;
  }

  if (definition.kind === "dynamic") {
    const expression = `toString(${definition.mapColumn}[${quote(definition.mapKey)}])`;
    const clause = buildStringOperatorClause(
      expression,
      condition.operator,
      condition.value,
    );
    if (!clause) {
      return null;
    }

    return `(mapContains(${definition.mapColumn}, ${quote(definition.mapKey)}) AND ${clause})`;
  }

  if (!definition.column) {
    return null;
  }

  return buildStringOperatorClause(
    definition.column,
    condition.operator,
    condition.value,
  );
};

const buildOuterConditionClause = (
  condition: z.infer<typeof traceFilterConditionSchema>,
) => {
  const definition = resolveTraceFilterAttributeDefinition(condition.attribute);
  if (!definition || definition.scope !== "outer") {
    return null;
  }

  if (definition.kind === "enum") {
    const values = parseMultiValueLiteral(condition.value).map((value) =>
      value.toLowerCase(),
    );
    const normalizedValues =
      values.length > 0 ? values : [condition.value.toLowerCase()];
    const validValues = normalizedValues.filter((value) =>
      ["ok", "error"].includes(value),
    );

    if (validValues.length === 0) {
      return null;
    }

    const includesError = validValues.includes("error");
    const includesOk = validValues.includes("ok");

    if (condition.operator === "eq") {
      return includesError ? "error_count > 0" : "error_count = 0";
    }
    if (condition.operator === "neq") {
      return includesError ? "error_count = 0" : "error_count > 0";
    }
    if (condition.operator === "in") {
      if (includesError && includesOk) {
        return "1 = 1";
      }

      return includesError ? "error_count > 0" : "error_count = 0";
    }
    if (condition.operator === "not_in") {
      if (includesError && includesOk) {
        return "1 = 0";
      }

      return includesError ? "error_count = 0" : "error_count > 0";
    }

    return null;
  }

  if (definition.kind === "duration") {
    const durationNs = parseDurationLiteralToNs(condition.value);
    if (durationNs === undefined) {
      return null;
    }

    switch (condition.operator) {
      case "eq":
        return `duration_ns = ${durationNs}`;
      case "neq":
        return `duration_ns != ${durationNs}`;
      case "gt":
        return `duration_ns > ${durationNs}`;
      case "gte":
        return `duration_ns >= ${durationNs}`;
      case "lt":
        return `duration_ns < ${durationNs}`;
      case "lte":
        return `duration_ns <= ${durationNs}`;
      default:
        return null;
    }
  }

  if (!definition.column) {
    return null;
  }

  return buildStringOperatorClause(
    definition.column,
    condition.operator,
    condition.value,
  );
};

const buildTraceFilterValueSuggestionsQuery = (
  definition: NonNullable<
    ReturnType<typeof resolveTraceFilterAttributeDefinition>
  >,
  appId: string,
  query: string,
  limit: number,
) => {
  const queryClause = query
    ? `AND positionCaseInsensitiveUTF8(value, ${quote(query)}) > 0`
    : "";

  if (definition.kind === "dynamic") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT toString(${definition.mapColumn}[${quote(definition.mapKey)}]) AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
          AND mapContains(${definition.mapColumn}, ${quote(definition.mapKey)})
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${limit}
    `;
  }

  if (definition.key === "trace.name") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT
          coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
        GROUP BY trace_id
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${limit}
    `;
  }

  if (definition.key === "trace.id") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT trace_id AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
        GROUP BY trace_id
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY value ASC
      LIMIT ${limit}
    `;
  }

  if (!("column" in definition) || !definition.column) {
    return `
      SELECT '' AS value, 0 AS count
      WHERE 1 = 0
    `;
  }

  return `
    SELECT
      value,
      count() AS count
    FROM (
      SELECT ${definition.column} AS value
      FROM traces_raw
      WHERE app_id = ${quote(appId)}
    )
    WHERE value != ''
      ${queryClause}
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT ${limit}
  `;
};

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

const buildTraceSummaryWhereClause = (
  appId: string,
  input: z.infer<typeof tracesQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `start_time >= ${toDateTime64(startAtUtc)}`,
    `start_time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.services.length > 0) {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0) {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  if (input.scopes.length > 0) {
    whereClauses.push(buildInClause("scope_name", input.scopes));
  }

  if (input.ingestionKeyIds.length > 0) {
    whereClauses.push(buildInClause("ingestion_key_id", input.ingestionKeyIds));
  }

  if (input.statusCodes.length > 0) {
    whereClauses.push(`status_code IN (${input.statusCodes.join(", ")})`);
  }

  return whereClauses.join(" AND ");
};

const buildWhereClause = (
  appId: string,
  input: z.infer<typeof tracesQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `start_time >= ${toDateTime64(startAtUtc)}`,
    `start_time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.search) {
    whereClauses.push(buildAnySearchClause(input.search));
  }

  if (input.services.length > 0) {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0) {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  if (input.scopes.length > 0) {
    whereClauses.push(buildInClause("scope_name", input.scopes));
  }

  if (input.ingestionKeyIds.length > 0) {
    whereClauses.push(buildInClause("ingestion_key_id", input.ingestionKeyIds));
  }

  if (input.statusCodes.length > 0) {
    whereClauses.push(`status_code IN (${input.statusCodes.join(", ")})`);
  }

  for (const condition of input.conditions) {
    const clause = buildInnerConditionClause(condition);
    if (clause) {
      whereClauses.push(clause);
    }
  }

  return whereClauses.join(" AND ");
};

export { TracesService };
