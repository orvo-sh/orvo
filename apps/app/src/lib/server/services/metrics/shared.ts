import { z } from "zod";

import {
  getMetricCatalogInputSchema,
  metricAggregationSchema,
  metricGroupBySchema,
  metricsQueryFiltersSchema,
} from "./schema";
import { buildInClause, quote, toDateTime64 } from "../shared/query-builders";
import { resolveTimeFilter } from "../shared/time-filter";

type FacetRow = {
  value: string;
  count: number | string;
};

type MetricAggregation = z.infer<typeof metricAggregationSchema>;
type MetricGroupBy = z.infer<typeof metricGroupBySchema>;

const resolveAggregationExpression = (
  aggregation: MetricAggregation,
  bucketSizeMs: number,
) => {
  const numericValueExpression =
    "coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count))";
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

export {
  buildMetricCatalogWhereClause,
  buildMetricsWhereClause,
  buildSeries,
  normalizeDateTime,
  normalizeFacetRows,
  resolveAggregationExpression,
  resolveGroupExpression,
};
export type { FacetRow };
