import { getMetricAttributeColumns } from "./attribute-columns";
import type { ClickHouse } from "@repo/clickhouse";
import {
  derivedMetrics,
  getMetricAggregationOptions,
  type MetricAggregation,
} from "$lib/metric-definitions";
import { quote, toDateTime64 } from "../shared/query-builders";

type MetricScope = {
  services?: { include: string[]; exclude: string[] };
  environments?: { include: string[]; exclude: string[] };
  scopes?: { include: string[]; exclude: string[] };
  spanNames?: { include: string[]; exclude: string[] };
  containerNames?: { include: string[]; exclude: string[] };
};

const metricScopeClauses = (
  scope: MetricScope = {},
  attributes: Record<string, { include: string[]; exclude: string[] }> = {},
  trace = false,
) => {
  const clauses: string[] = [];
  for (const [key, column] of Object.entries({
    services: "service_name",
    environments: "deployment_environment",
    scopes: "scope_name",
    ...(trace ? { spanNames: "name" } : { containerNames: "container_name" }),
  })) {
    const values = scope[key as keyof MetricScope];
    if (values?.include.length)
      clauses.push(`${column} IN (${values.include.map(quote).join(",")})`);
    if (values?.exclude.length)
      clauses.push(`${column} NOT IN (${values.exclude.map(quote).join(",")})`);
  }
  const map = `mapUpdate(resource_attributes, ${trace ? "span_attributes" : "attributes"})`;
  const attributeColumns = getMetricAttributeColumns(trace);
  for (const [key, values] of Object.entries(attributes)) {
    if (attributeColumns[key]) {
      const column = attributeColumns[key];
      if (values.include.length)
        clauses.push(`${column} IN (${values.include.map(quote).join(",")})`);
      if (values.exclude.length)
        clauses.push(
          `${column} NOT IN (${values.exclude.map(quote).join(",")})`,
        );
      continue;
    }
    if (values.include.length)
      clauses.push(
        `mapContains(${map}, ${quote(key)}) AND ${map}[${quote(key)}] IN (${values.include.map(quote).join(",")})`,
      );
    if (values.exclude.length)
      clauses.push(
        `${map}[${quote(key)}] NOT IN (${values.exclude.map(quote).join(",")})`,
      );
  }
  return clauses;
};

const readMetricDefinition = async (
  clickhouse: ClickHouse,
  appId: string,
  name: string,
) => {
  const derived = derivedMetrics.find((item) => item.name === name);
  if (derived) return { ...derived, isMonotonic: Boolean(derived.isMonotonic) };
  if (name.startsWith("$")) return null;
  const result = await clickhouse.query({
    format: "JSONEachRow",
    query: `SELECT any(metric_type) AS type, any(metric_unit) AS unit, any(is_monotonic) AS monotonic, any(description) AS description FROM metrics_raw WHERE app_id = ${quote(appId)} AND metric_name = ${quote(name)} HAVING count() > 0 AND uniqExact(tuple(metric_type, metric_unit, is_monotonic)) = 1`,
  });
  const [row] = (await result.json()) as unknown as {
    type: string;
    unit: string;
    monotonic: boolean | number;
    description: string;
  }[];
  return row
    ? {
        name,
        type: row.type,
        unit: row.unit,
        isMonotonic: Boolean(row.monotonic),
        description: row.description,
      }
    : null;
};

type MetricQueryInput = {
  appId: string;
  name: string;
  aggregation: MetricAggregation;
  start: Date;
  end: Date;
  bucketCount?: number;
  groupBy?: "none" | "service" | "environment" | "metric" | "container";
  scope?: MetricScope;
  attributes?: Record<string, { include: string[]; exclude: string[] }>;
};

const queryMetric = async (
  clickhouse: ClickHouse,
  input: MetricQueryInput,
): Promise<
  {
    bucket_index: number;
    group_key: string;
    value: number | null;
    points: number;
  }[]
> => {
  const definition = await readMetricDefinition(
    clickhouse,
    input.appId,
    input.name,
  );
  if (!definition) return [];
  if (
    !getMetricAggregationOptions(definition).some(
      (option) => option.value === input.aggregation,
    )
  )
    throw new Error("Choose an aggregation supported by this metric.");
  const buckets = input.bucketCount ?? 1;
  const bucketMs = Math.max(
    Math.ceil((input.end.getTime() - input.start.getTime()) / buckets),
    1,
  );
  const derived = derivedMetrics.find((metric) => metric.name === input.name);
  const trace = !!derived;
  const time = trace ? "start_time" : "time";
  const group =
    input.groupBy === "service"
      ? "if(service_name = '', 'unknown service', service_name)"
      : input.groupBy === "environment"
        ? "if(deployment_environment = '', 'unknown environment', deployment_environment)"
        : input.groupBy === "container"
          ? "if(container_id = '', container_name, container_id)"
          : quote(input.groupBy === "metric" ? input.name : "all");
  const bucket = `least(toInt32(intDiv(toUnixTimestamp64Milli(${time}) - ${input.start.getTime()}, ${bucketMs})), ${buckets - 1})`;
  const seconds = `greatest(least(${bucketMs}, ${input.end.getTime() - input.start.getTime()} - bucket_index * ${bucketMs}) / 1000.0, 0.001)`;
  const where = [
    `app_id = ${quote(input.appId)}`,
    ...metricScopeClauses(input.scope, input.attributes, trace),
  ];
  const range = [
    `${time} >= ${toDateTime64(input.start)}`,
    `${time} < ${toDateTime64(input.end)}`,
  ];
  let query: string;
  if (trace) {
    const count =
      input.name === "$request.error_count"
        ? "countIf(status_code = 2)"
        : "count()";
    const expressions: Record<string, string> = {
      "$request.count": count,
      "$request.error_count": count,
      "$request.error_rate": "100.0 * countIf(status_code = 2) / count()",
      "$request.duration": input.aggregation.startsWith("p")
        ? `quantileTDigest(${Number(input.aggregation.slice(1)) / 100})(duration_ns) / 1000000.0`
        : input.aggregation === "count"
          ? "count()"
          : `${input.aggregation}(duration_ns) / 1000000.0`,
    };
    let expression = expressions[input.name];
    if (input.aggregation === "rate_per_sec")
      expression = `${count} / ${seconds}`;
    if (input.aggregation === "rate_per_min")
      expression = `${count} / (${seconds} / 60.0)`;
    query = `SELECT ${bucket} AS bucket_index, ${group} AS group_key, ${expression} AS value, count() AS points FROM traces_raw WHERE ${[...where, ...range, "kind = 2"].join(" AND ")} GROUP BY bucket_index, group_key`;
  } else {
    where.push(`metric_name = ${quote(input.name)}`, "bitAnd(flags, 1) = 0");
    const series = `tuple(service_name, deployment_environment, scope_name, scope_version, arraySort(arrayZip(mapKeys(resource_attributes),mapValues(resource_attributes))), arraySort(arrayZip(mapKeys(attributes),mapValues(attributes))))`;
    const numeric = "coalesce(value_double,toFloat64(value_int))";
    if (
      definition.type === "sum" &&
      definition.isMonotonic &&
      input.aggregation !== "total"
    ) {
      const delta = `if(aggregation_temporality = 'delta', v, if(previous_time > toDateTime64(0,3) AND previous_start = start_time AND v >= previous_value, v - previous_value, if(start_time >= ${toDateTime64(input.start)} OR previous_time > toDateTime64(0,3), v, NULL)))`;
      let expression = "sum(increment)";
      if (input.aggregation === "rate_per_sec") expression += ` / ${seconds}`;
      if (input.aggregation === "rate_per_min")
        expression += ` / (${seconds} / 60.0)`;
      query = `WITH points AS (SELECT *, ${numeric} AS v, lagInFrame(${numeric},1,NULL) OVER w AS previous_value, lagInFrame(time,1,toDateTime64(0,3)) OVER w AS previous_time, lagInFrame(start_time,1,toDateTime64(0,3)) OVER w AS previous_start FROM metrics_raw WHERE ${[...where, `time < ${toDateTime64(input.end)}`].join(" AND ")} WINDOW w AS (PARTITION BY ${series} ORDER BY time, start_time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) SELECT ${bucket} AS bucket_index, ${group} AS group_key, ${expression} AS value, count(increment) AS points FROM (SELECT *, ${delta} AS increment FROM points WHERE ${range.join(" AND ")}) GROUP BY bucket_index, group_key HAVING count(increment) > 0`;
    } else if (definition.type === "histogram") {
      return queryHistogram(clickhouse, input, {
        where,
        range,
        series,
        bucket,
        group,
      });
    } else if (
      input.aggregation === "current" ||
      input.aggregation === "total"
    ) {
      query = `SELECT bucket_index, group_key, ${input.aggregation === "total" ? "sum" : "max"}(latest) AS value, sum(points) AS points FROM (SELECT ${bucket} AS bucket_index, ${group} AS group_key, ${series} AS series_key, argMax(${numeric}, tuple(time,start_time)) AS latest, count() AS points FROM metrics_raw WHERE ${[...where, ...range, `isFinite(${numeric})`].join(" AND ")} GROUP BY bucket_index, group_key, series_key) GROUP BY bucket_index, group_key`;
    } else {
      query = `SELECT ${bucket} AS bucket_index, ${group} AS group_key, ${input.aggregation}(${numeric}) AS value, count() AS points FROM metrics_raw WHERE ${[...where, ...range, `isFinite(${numeric})`].join(" AND ")} GROUP BY bucket_index, group_key`;
    }
  }
  const result = await clickhouse.query({ format: "JSONEachRow", query });
  const rows = (await result.json()) as unknown as {
    bucket_index: number;
    group_key: string;
    value: number | string | null;
    points: number | string;
  }[];
  return rows
    .map((row) => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
      points: Number(row.points),
    }))
    .filter((row) => row.value !== null && Number.isFinite(row.value));
};

// Histogram bucket counts are interval counts, not cumulative Prometheus buckets.
const queryHistogram = async (
  clickhouse: ClickHouse,
  input: MetricQueryInput,
  sql: {
    where: string[];
    range: string[];
    series: string;
    bucket: string;
    group: string;
  },
): Promise<
  {
    bucket_index: number;
    group_key: string;
    value: number | null;
    points: number;
  }[]
> => {
  const reset =
    "previous_time = toDateTime64(0,3) OR previous_start != start_time OR histogram_count < previous_count OR histogram_explicit_bounds != previous_bounds";
  const known = `aggregation_temporality = 'delta' OR previous_time > toDateTime64(0,3) OR start_time >= ${toDateTime64(input.start)}`;
  const deltaCount = `if(aggregation_temporality = 'delta' OR ${reset}, toFloat64(histogram_count), toFloat64(histogram_count) - toFloat64(previous_count))`;
  const deltaSum = `if(aggregation_temporality = 'delta' OR ${reset}, histogram_sum, histogram_sum - previous_sum)`;
  const deltaBuckets = `if(aggregation_temporality = 'delta' OR ${reset}, arrayMap(a -> toFloat64(a), histogram_bucket_counts), arrayMap((a,b) -> greatest(toFloat64(a) - toFloat64(b), 0), histogram_bucket_counts, previous_buckets))`;
  const cte = `WITH points AS (SELECT *, lagInFrame(time,1,toDateTime64(0,3)) OVER w AS previous_time, lagInFrame(start_time,1,toDateTime64(0,3)) OVER w AS previous_start, lagInFrame(histogram_count,1,NULL) OVER w AS previous_count, lagInFrame(histogram_sum,1,NULL) OVER w AS previous_sum, lagInFrame(histogram_explicit_bounds,1,[]) OVER w AS previous_bounds, lagInFrame(histogram_bucket_counts,1,[]) OVER w AS previous_buckets FROM metrics_raw WHERE ${[...sql.where, `time < ${toDateTime64(input.end)}`].join(" AND ")} WINDOW w AS (PARTITION BY ${sql.series} ORDER BY time,start_time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)), deltas AS (SELECT *, ${deltaCount} AS delta_count, ${deltaSum} AS delta_sum, ${deltaBuckets} AS delta_buckets FROM points WHERE ${sql.range.join(" AND ")} AND (${known}))`;
  if (input.aggregation === "avg" || input.aggregation === "count") {
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `${cte} SELECT ${sql.bucket} AS bucket_index, ${sql.group} AS group_key, ${input.aggregation === "count" ? "sum(delta_count)" : "sum(delta_sum) / nullIf(sum(delta_count),0)"} AS value, count() AS points FROM deltas GROUP BY bucket_index,group_key`,
    });
    const rows = (await result.json()) as unknown as {
      bucket_index: number;
      group_key: string;
      value: number | null;
      points: number;
    }[];
    return rows.map((row) => ({
      ...row,
      points: Number(row.points),
      value: row.value === null ? null : Number(row.value),
    }));
  }
  const result = await clickhouse.query({
    format: "JSONEachRow",
    query: `${cte} SELECT ${sql.bucket} AS bucket_index, ${sql.group} AS group_key, histogram_explicit_bounds AS bounds, sumForEach(delta_buckets) AS counts, count() AS points FROM deltas GROUP BY bucket_index,group_key,bounds`,
  });
  const rows = (await result.json()) as unknown as {
    bucket_index: number;
    group_key: string;
    bounds: number[];
    counts: (number | string)[];
    points: number | string;
  }[];
  const grouped = new Map<
    string,
    {
      bucket_index: number;
      group_key: string;
      bounds: number[];
      counts: number[];
      points: number;
    }
  >();
  for (const row of rows) {
    const key = JSON.stringify([row.bucket_index, row.group_key]);
    const existing = grouped.get(key);
    if (
      existing &&
      JSON.stringify(existing.bounds) !== JSON.stringify(row.bounds)
    )
      throw new Error(
        "Histogram bucket boundaries differ across matching series. Narrow the scope.",
      );
    grouped.set(key, {
      ...row,
      counts: row.counts.map(Number),
      points: Number(row.points),
    });
  }
  return [...grouped.values()].map((row) => {
    const count = row.counts.reduce((sum, value) => sum + value, 0);
    const rank = (count * Number(input.aggregation.slice(1))) / 100;
    let cumulative = 0;
    let value: number | null = null;
    for (let index = 0; index < row.counts.length && count > 0; index++) {
      const next = cumulative + row.counts[index];
      if (next >= rank) {
        const upper = row.bounds[index];
        const lower =
          index === 0 ? Math.min(0, upper ?? 0) : row.bounds[index - 1];
        value =
          upper === undefined
            ? lower
            : lower +
              ((upper - lower) * (rank - cumulative)) /
                Math.max(row.counts[index], 1);
        break;
      }
      cumulative = next;
    }
    return {
      bucket_index: row.bucket_index,
      group_key: row.group_key,
      value,
      points: row.points,
    };
  });
};

export { metricScopeClauses, readMetricDefinition, queryMetric };
export type { MetricScope, MetricQueryInput };
