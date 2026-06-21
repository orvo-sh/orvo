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

  async getMetricCatalog(
    input: z.input<typeof getMetricCatalogInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getMetricCatalog: fetching metric catalog", {
      input,
      context,
    });

    const validated = getMetricCatalogInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const whereClause = buildMetricCatalogWhereClause(
        context.appId,
        validated.data,
      );
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            metric_name,
            any(metric_type) AS metric_type,
            any(metric_unit) AS metric_unit,
            any(description) AS description,
            count() AS points,
            uniqExactIf(service_name, service_name != '') AS services,
            uniqExactIf(host_id, host_id != '') AS hosts,
            uniqExactIf(container_id, container_id != '') AS containers,
            any(is_monotonic) AS is_monotonic,
            max(time) AS last_seen,
            argMax(coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)), time) AS last_value
          FROM metrics_raw
          WHERE ${whereClause}
          GROUP BY metric_name
          ORDER BY metric_name ASC
          LIMIT ${validated.data.limit}
        `,
      });
      const rows = (await result.json()) as unknown as Array<{
        metric_name: string;
        metric_type: string;
        metric_unit: string;
        description: string;
        points: number | string;
        services: number | string;
        hosts: number | string;
        containers: number | string;
        is_monotonic: boolean | number;
        last_seen: string | Date;
        last_value: number | string | null;
      }>;

      return ok({
        catalog: rows.map((row) => ({
          name: row.metric_name,
          type: row.metric_type,
          unit: row.metric_unit,
          description: row.description,
          points: Number(row.points),
          services: Number(row.services),
          hosts: Number(row.hosts),
          containers: Number(row.containers),
          isMonotonic: Boolean(row.is_monotonic),
          lastSeen: normalizeDateTime(row.last_seen),
          lastValue: row.last_value === null ? null : Number(row.last_value),
        })),
      });
    } catch (error) {
      this.logger.error(
        "getMetricCatalog: failed to fetch metric catalog",
        error as Error,
      );
      return err("Failed to fetch metric catalog.");
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
        bucketSizeMs,
      );

      const [
        summaryResult,
        metricFacetsResult,
        serviceFacetsResult,
        environmentFacetsResult,
        hostFacetsResult,
        containerFacetsResult,
        entityKindFacetsResult,
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
              if(host_name = '', host_id, host_name) AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
              AND (host_name != '' OR host_id != '')
            GROUP BY value
            ORDER BY count DESC
            LIMIT 50
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              if(container_name = '', container_id, container_name) AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
              AND (container_name != '' OR container_id != '')
            GROUP BY value
            ORDER BY count DESC
            LIMIT 50
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              entity_kind AS value,
              count() AS count
            FROM metrics_raw
            WHERE ${summaryWhereClause}
              AND entity_kind != ''
            GROUP BY entity_kind
            ORDER BY count DESC
            LIMIT 10
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
              uniqExactIf(host_id, host_id != '') AS hosts,
              uniqExactIf(container_id, container_id != '') AS containers,
              any(is_monotonic) AS is_monotonic,
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
              host_name,
              host_id,
              container_name,
              container_id,
              entity_kind,
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
      const hostFacetRows =
        (await hostFacetsResult.json()) as unknown as FacetRow[];
      const containerFacetRows =
        (await containerFacetsResult.json()) as unknown as FacetRow[];
      const entityKindFacetRows =
        (await entityKindFacetsResult.json()) as unknown as FacetRow[];
      const catalogRows = (await catalogResult.json()) as unknown as Array<{
        metric_name: string;
        metric_type: string;
        metric_unit: string;
        description: string;
        points: number | string;
        services: number | string;
        hosts: number | string;
        containers: number | string;
        is_monotonic: boolean | number;
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
        host_name: string;
        host_id: string;
        container_name: string;
        container_id: string;
        entity_kind: string;
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
          hosts: normalizeFacetRows(hostFacetRows),
          containers: normalizeFacetRows(containerFacetRows),
          entityKinds: normalizeFacetRows(entityKindFacetRows),
        },
        catalog: catalogRows.map((row) => ({
          name: row.metric_name,
          type: row.metric_type,
          unit: row.metric_unit,
          description: row.description,
          points: Number(row.points),
          services: Number(row.services),
          hosts: Number(row.hosts),
          containers: Number(row.containers),
          isMonotonic: Boolean(row.is_monotonic),
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
          hostName: row.host_name || row.host_id,
          containerName: row.container_name || row.container_id,
          entityKind: row.entity_kind || "application",
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

const metricAggregationValues = [
  "p50",
  "p95",
  "p99",
  "avg",
  "min",
  "max",
  "count",
  "rate_per_sec",
  "rate_per_min",
  "increase",
  "total",
  "current",
] as const;
const metricGroupByValues = [
  "none",
  "metric",
  "service",
  "environment",
] as const;
const metricEntityKindValues = ["application", "host", "container"] as const;

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const metricAggregationSchema = z.enum(metricAggregationValues);
const metricGroupBySchema = z.enum(metricGroupByValues);
const metricEntityKindSchema = z.enum(metricEntityKindValues);

export const metricsQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  metricName: z.string().trim().min(1).max(255).optional(),
  search: z.string().trim().max(500).optional().default(""),
  aggregation: metricAggregationSchema.default("avg"),
  groupBy: metricGroupBySchema.default("none"),
  services: stringArrayFilterSchema.optional().default([]),
  environments: stringArrayFilterSchema.optional().default([]),
  hosts: stringArrayFilterSchema.optional().default([]),
  containers: stringArrayFilterSchema.optional().default([]),
  entityKinds: z.array(metricEntityKindSchema).max(10).default([]),
});

export const getMetricCatalogInputSchema = z.object({
  time: timeFilterSchema,
  search: z.string().trim().max(500).optional().default(""),
  limit: z.number().int().min(1).max(250).default(100),
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

const resolveAggregationExpression = (
  aggregation: MetricAggregation,
  bucketSizeMs: number,
) => {
  const numericValueExpression =
    "coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count))";
  const sumValueExpression =
    "ifNull(value_double, toFloat64(ifNull(value_int, 0))) + ifNull(histogram_sum, 0)";
  const counterIncreaseExpression = `greatest(max(${numericValueExpression}) - min(${numericValueExpression}), 0)`;

  if (aggregation === "current") {
    return `argMax(${numericValueExpression}, time)`;
  }

  if (aggregation === "total") {
    return `max(${numericValueExpression})`;
  }

  if (aggregation === "increase") {
    return counterIncreaseExpression;
  }

  if (aggregation === "rate_per_sec") {
    return `${counterIncreaseExpression} / ${Math.max(bucketSizeMs / 1000, 1)}`;
  }

  if (aggregation === "rate_per_min") {
    return `${counterIncreaseExpression} / ${Math.max(bucketSizeMs / 60_000, 1)}`;
  }

  if (aggregation === "count") {
    return "if(sum(ifNull(histogram_count, 0)) > 0, sum(ifNull(histogram_count, 0)), count())";
  }

  if (aggregation === "min") {
    return "min(coalesce(value_double, toFloat64(value_int), histogram_min, histogram_sum))";
  }

  if (aggregation === "max") {
    return "max(coalesce(value_double, toFloat64(value_int), histogram_max, histogram_sum))";
  }

  if (aggregation === "avg") {
    return `
      if(
        sum(ifNull(histogram_count, 0)) > 0,
        sum(ifNull(histogram_sum, 0)) / sum(ifNull(histogram_count, 0)),
        avg(coalesce(value_double, toFloat64(value_int)))
      )
    `;
  }

  const quantileLevel =
    aggregation === "p50" ? 0.5 : aggregation === "p95" ? 0.95 : 0.99;

  return `
    if(
      sum(ifNull(histogram_count, 0)) > 0,
      quantileExactWeighted(${quantileLevel})(
        coalesce(histogram_max, histogram_sum, ${numericValueExpression}),
        greatest(toUInt64(ifNull(histogram_count, 0)), toUInt64(1))
      ),
      quantileExactWeighted(${quantileLevel})(
        coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)),
        toUInt64(1)
      )
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

  if (input.hosts.length > 0) {
    whereClauses.push(
      buildInClause("if(host_name = '', host_id, host_name)", input.hosts),
    );
  }

  if (input.containers.length > 0) {
    whereClauses.push(
      buildInClause(
        "if(container_name = '', container_id, container_name)",
        input.containers,
      ),
    );
  }

  if (input.entityKinds.length > 0) {
    whereClauses.push(buildInClause("entity_kind", input.entityKinds));
  }

  return whereClauses.join(" AND ");
};

const buildMetricCatalogWhereClause = (
  appId: string,
  input: z.infer<typeof getMetricCatalogInputSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `time >= ${toDateTime64(startAtUtc)}`,
    `time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.search) {
    whereClauses.push(
      `(positionCaseInsensitiveUTF8(metric_name, ${quote(input.search)}) > 0 OR positionCaseInsensitiveUTF8(description, ${quote(input.search)}) > 0)`,
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
