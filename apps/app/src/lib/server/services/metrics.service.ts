import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import { buildInClause, quote, toDateTime64 } from "./shared/query-builders";
import { resolveTimeFilter, timeFilterSchema } from "./shared/time-filter";

class MetricsService {
  private logger: Logger;

  constructor(
    private clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("MetricsService");
  }

  async getTotalMetrics(
    input: z.input<typeof getTotalMetricsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getTotalMetrics: fetching total metrics", {
      input,
      context,
    });

    const validated = getTotalMetricsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter(validated.data.time);
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT count() AS total
          FROM metrics_raw
          WHERE app_id = ${quote(context.appId)}
            AND time >= ${toDateTime64(startAtUtc)}
            AND time <= ${toDateTime64(endAtUtc)}
        `,
      });
      const rows = (await result.json()) as unknown as Array<{
        total: number | string;
      }>;
      return ok({ total: Number(rows[0]?.total ?? 0) });
    } catch (error) {
      this.logger.error(
        "getTotalMetrics: failed to fetch total metrics",
        error as Error,
      );
      return err("Failed to fetch total metrics.");
    }
  }

  async getMetricsTrend(
    input: z.input<typeof getTotalMetricsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getMetricsTrend: computing metric trend", {
      input,
      context,
    });

    const validated = getTotalMetricsInputSchema.safeParse(input);
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
            SELECT count() AS total
            FROM metrics_raw
            WHERE app_id = ${quote(context.appId)}
              AND time >= ${toDateTime64(startAtUtc)}
              AND time <= ${toDateTime64(endAtUtc)}
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT count() AS total
            FROM metrics_raw
            WHERE app_id = ${quote(context.appId)}
              AND time >= ${toDateTime64(baselineStart)}
              AND time <= ${toDateTime64(baselineEnd)}
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
        "getMetricsTrend: failed to compute metric trend",
        error as Error,
      );
      return err("Failed to compute metric trend.");
    }
  }

  async getMetricsExplorer(
    input: z.input<typeof getMetricsExplorerInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getMetricsExplorer: fetching metrics explorer", {
      input,
      context,
    });

    const validated = getMetricsExplorerInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const timeRange = resolveTimeFilter(validated.data.time);
      const rangeMs = Math.max(
        timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
        1,
      );
      const bucketCount = validated.data.bucketCount;
      const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
      const whereClause = buildMetricsWhereClause(
        context.appId,
        validated.data,
      );
      const summaryWhereClause = buildMetricsWhereClause(context.appId, {
        ...validated.data,
        metricName: undefined,
      });
      const groupExpression = resolveGroupExpression(validated.data.groupBy);
      const aggregationExpression = resolveAggregationExpression(
        validated.data.aggregation,
      );

      const [
        summaryResult,
        metricFacetsResult,
        serviceFacetsResult,
        environmentFacetsResult,
        catalogResult,
        seriesResult,
        samplesResult,
      ] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              count() AS total_points,
              uniqExact(metric_name) AS metric_count,
              uniqExactIf(service_name, service_name != '') AS service_count,
              uniqExactIf(deployment_environment, deployment_environment != '') AS environment_count,
              max(time) AS last_seen
            FROM metrics_raw
            WHERE ${summaryWhereClause}
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              metric_name AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
            GROUP BY metric_name
            ORDER BY count DESC
            LIMIT 100
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              service_name AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
              AND service_name != ''
            GROUP BY service_name
            ORDER BY count DESC
            LIMIT 50
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              deployment_environment AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
              AND deployment_environment != ''
            GROUP BY deployment_environment
            ORDER BY count DESC
            LIMIT 50
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              metric_name,
              any(metric_type) AS metric_type,
              any(metric_unit) AS metric_unit,
              any(description) AS description,
              count() AS points,
              uniqExactIf(service_name, service_name != '') AS services,
              max(time) AS last_seen,
              argMax(coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)), time) AS last_value
            FROM metrics_raw
            WHERE ${summaryWhereClause}
            GROUP BY metric_name
            ORDER BY points DESC, last_seen DESC
            LIMIT 100
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            WITH
              ${timeRange.startAtUtc.getTime()} AS start_ms,
              ${bucketSizeMs} AS bucket_ms
            SELECT
              least(toInt32(intDiv(toUnixTimestamp64Milli(time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
              ${groupExpression} AS group_key,
              ${aggregationExpression} AS value,
              count() AS points
            FROM metrics_raw
            WHERE ${whereClause}
            GROUP BY bucket_index, group_key
            ORDER BY bucket_index ASC, points DESC
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              metric_name,
              metric_type,
              metric_unit,
              service_name,
              deployment_environment,
              time,
              coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)) AS value
            FROM metrics_raw
            WHERE ${whereClause}
            ORDER BY time DESC, id DESC
            LIMIT ${validated.data.sampleLimit}
          `,
        }),
      ]);

      const summaryRows = (await summaryResult.json()) as unknown as Array<{
        total_points: number | string;
        metric_count: number | string;
        service_count: number | string;
        environment_count: number | string;
        last_seen: string | Date;
      }>;
      const metricFacetRows =
        (await metricFacetsResult.json()) as unknown as FacetRow[];
      const serviceFacetRows =
        (await serviceFacetsResult.json()) as unknown as FacetRow[];
      const environmentFacetRows =
        (await environmentFacetsResult.json()) as unknown as FacetRow[];
      const catalogRows = (await catalogResult.json()) as unknown as Array<{
        metric_name: string;
        metric_type: string;
        metric_unit: string;
        description: string;
        points: number | string;
        services: number | string;
        last_seen: string | Date;
        last_value: number | string | null;
      }>;
      const seriesRows = (await seriesResult.json()) as unknown as Array<{
        bucket_index: number;
        group_key: string;
        value: number | string | null;
        points: number | string;
      }>;
      const sampleRows = (await samplesResult.json()) as unknown as Array<{
        metric_name: string;
        metric_type: string;
        metric_unit: string;
        service_name: string;
        deployment_environment: string;
        time: string | Date;
        value: number | string | null;
      }>;

      const summary = summaryRows[0];

      return ok({
        summary: {
          totalPoints: Number(summary?.total_points ?? 0),
          metricCount: Number(summary?.metric_count ?? 0),
          serviceCount: Number(summary?.service_count ?? 0),
          environmentCount: Number(summary?.environment_count ?? 0),
          lastSeen: summary?.last_seen
            ? normalizeDateTime(summary.last_seen)
            : null,
        },
        facets: {
          metrics: normalizeFacetRows(metricFacetRows),
          services: normalizeFacetRows(serviceFacetRows),
          environments: normalizeFacetRows(environmentFacetRows),
        },
        catalog: catalogRows.map((row) => ({
          name: row.metric_name,
          type: row.metric_type,
          unit: row.metric_unit,
          description: row.description,
          points: Number(row.points),
          services: Number(row.services),
          lastSeen: normalizeDateTime(row.last_seen),
          lastValue: row.last_value === null ? null : Number(row.last_value),
        })),
        series: buildSeries(seriesRows, {
          bucketCount,
          bucketSizeMs,
          startAtUtc: timeRange.startAtUtc,
          endAtUtc: timeRange.endAtUtc,
        }),
        samples: sampleRows.map((row) => ({
          metricName: row.metric_name,
          type: row.metric_type,
          unit: row.metric_unit,
          serviceName: row.service_name,
          environment: row.deployment_environment,
          time: normalizeDateTime(row.time),
          value: row.value === null ? null : Number(row.value),
        })),
        startAtUtc: timeRange.startAtUtc.toISOString(),
        endAtUtc: timeRange.endAtUtc.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        "getMetricsExplorer: failed to fetch metrics explorer",
        error as Error,
      );
      return err("Failed to fetch metrics.");
    }
  }
}

const metricAggregationValues = ["avg", "sum", "min", "max", "count"] as const;
const metricGroupByValues = [
  "none",
  "metric",
  "service",
  "environment",
] as const;

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const metricAggregationSchema = z.enum(metricAggregationValues);
const metricGroupBySchema = z.enum(metricGroupByValues);

export const metricsQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  metricName: z.string().trim().min(1).max(255).optional(),
  search: z.string().trim().max(500).optional().default(""),
  aggregation: metricAggregationSchema.default("avg"),
  groupBy: metricGroupBySchema.default("none"),
  services: stringArrayFilterSchema.optional().default([]),
  environments: stringArrayFilterSchema.optional().default([]),
});

export const getMetricsExplorerInputSchema = metricsQueryFiltersSchema.extend({
  bucketCount: z.number().int().min(10).max(240).default(80),
  sampleLimit: z.number().int().min(1).max(100).default(50),
});

export const getTotalMetricsInputSchema = z.object({
  time: timeFilterSchema,
});

export type MetricAggregation = z.infer<typeof metricAggregationSchema>;
export type MetricGroupBy = z.infer<typeof metricGroupBySchema>;

export { MetricsService };

type FacetRow = {
  value: string;
  count: number | string;
};

const resolveAggregationExpression = (aggregation: MetricAggregation) => {
  if (aggregation === "count") {
    return "count()";
  }

  if (aggregation === "sum") {
    return "sum(ifNull(value_double, toFloat64(ifNull(value_int, 0))) + ifNull(histogram_sum, 0))";
  }

  if (aggregation === "min") {
    return "min(coalesce(value_double, toFloat64(value_int), histogram_min))";
  }

  if (aggregation === "max") {
    return "max(coalesce(value_double, toFloat64(value_int), histogram_max))";
  }

  return `
    if(
      sum(ifNull(histogram_count, 0)) > 0,
      sum(ifNull(histogram_sum, 0)) / sum(ifNull(histogram_count, 0)),
      avg(coalesce(value_double, toFloat64(value_int)))
    )
  `;
};

const resolveGroupExpression = (groupBy: MetricGroupBy) => {
  if (groupBy === "metric") {
    return "metric_name";
  }

  if (groupBy === "service") {
    return "if(service_name = '', 'unknown service', service_name)";
  }

  if (groupBy === "environment") {
    return "if(deployment_environment = '', 'unknown environment', deployment_environment)";
  }

  return "'all metrics'";
};

const buildMetricsWhereClause = (
  appId: string,
  input: z.infer<typeof metricsQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `time >= ${toDateTime64(startAtUtc)}`,
    `time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.metricName) {
    whereClauses.push(`metric_name = ${quote(input.metricName)}`);
  }

  if (input.search) {
    whereClauses.push(
      `(positionCaseInsensitiveUTF8(metric_name, ${quote(input.search)}) > 0 OR positionCaseInsensitiveUTF8(description, ${quote(input.search)}) > 0)`,
    );
  }

  if (input.services.length > 0) {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0) {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  return whereClauses.join(" AND ");
};

const buildSeries = (
  rows: {
    bucket_index: number;
    group_key: string;
    value: number | string | null;
    points: number | string;
  }[],
  time: {
    bucketCount: number;
    bucketSizeMs: number;
    startAtUtc: Date;
    endAtUtc: Date;
  },
) => {
  const groupedRows = new Map<string, Map<number, (typeof rows)[number]>>();
  const pointCounts = new Map<string, number>();

  for (const row of rows) {
    const groupKey = row.group_key || "unknown";
    if (!groupedRows.has(groupKey)) {
      groupedRows.set(groupKey, new Map());
    }
    groupedRows.get(groupKey)!.set(row.bucket_index, row);
    pointCounts.set(
      groupKey,
      (pointCounts.get(groupKey) ?? 0) + Number(row.points ?? 0),
    );
  }

  return Array.from(groupedRows.entries())
    .sort(
      ([left], [right]) =>
        (pointCounts.get(right) ?? 0) - (pointCounts.get(left) ?? 0),
    )
    .slice(0, 8)
    .map(([name, bucketMap]) => ({
      name,
      points: Number(pointCounts.get(name) ?? 0),
      buckets: Array.from({ length: time.bucketCount }, (_, index) => {
        const bucketStart = new Date(
          time.startAtUtc.getTime() + index * time.bucketSizeMs,
        );
        const bucketEnd = new Date(
          Math.min(
            time.startAtUtc.getTime() + (index + 1) * time.bucketSizeMs,
            time.endAtUtc.getTime(),
          ),
        );
        const row = bucketMap.get(index);

        return {
          startAtUtc: bucketStart.toISOString(),
          endAtUtc: bucketEnd.toISOString(),
          value: row?.value === null ? null : Number(row?.value ?? 0),
          points: Number(row?.points ?? 0),
        };
      }),
    }));
};

const normalizeFacetRows = (rows: FacetRow[]) =>
  rows
    .filter((row) => row.value)
    .map(({ value, count }) => ({
      value,
      count: Number(count),
    }));

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value.includes("T")) {
    return value.endsWith("Z") ? value : `${value}Z`;
  }

  return `${value.replace(" ", "T")}Z`;
};
