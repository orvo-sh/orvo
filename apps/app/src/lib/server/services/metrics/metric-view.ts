import type { ClickHouse } from "@repo/clickhouse";
import { derivedMetrics } from "$lib/metric-definitions";
import {
  queryMetric,
  metricScopeClauses,
  readMetricDefinition,
} from "./metric-query";
import { buildSeries } from "./shared";
import {
  normalizeDateTime,
  quote,
  toDateTime64,
} from "../shared/query-builders";
import { resolveTimeFilter } from "../shared/time-filter";
import type { z } from "zod";
import type { getMetricsExplorerInputSchema } from "./schema";

const getMetricView = async (
  clickhouse: ClickHouse,
  input: z.infer<typeof getMetricsExplorerInputSchema>,
  appId: string,
) => {
  const definition = await readMetricDefinition(
    clickhouse,
    appId,
    input.metricName!,
  );
  if (!definition)
    throw new Error("Metric not found or its type and unit are inconsistent.");
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const scope = {
    services: { include: input.services, exclude: [] },
    environments: { include: input.environments, exclude: [] },
    containerNames: { include: input.containers, exclude: [] },
  };
  const request = {
    appId,
    name: definition.name,
    aggregation: input.aggregation,
    start: startAtUtc,
    end: endAtUtc,
    scope,
  };
  const [rows, summaryRows] = await Promise.all([
    queryMetric(clickhouse, {
      ...request,
      bucketCount: input.bucketCount,
      groupBy: input.groupBy,
    }),
    queryMetric(clickhouse, { ...request, bucketCount: 1, groupBy: "none" }),
  ]);
  const trace = derivedMetrics.some(
    (metric) => metric.name === definition.name,
  );
  const table = trace ? "traces_raw" : "metrics_raw";
  const time = trace ? "start_time" : "time";
  const clauses = [
    `app_id = ${quote(appId)}`,
    `${time} >= ${toDateTime64(startAtUtc)}`,
    `${time} < ${toDateTime64(endAtUtc)}`,
    ...metricScopeClauses(scope, {}, trace),
  ];
  if (trace) clauses.push("kind = 2");
  else clauses.push(`metric_name = ${quote(definition.name)}`);
  if (!trace && input.entityKinds.length)
    clauses.push(`entity_kind IN (${input.entityKinds.map(quote).join(",")})`);
  const result = await clickhouse.query({
    format: "JSONEachRow",
    query: `SELECT service_name, deployment_environment, count() AS points, max(${time}) AS last_seen FROM ${table} WHERE ${clauses.join(" AND ")} GROUP BY service_name,deployment_environment`,
  });
  const metadata = (await result.json()) as unknown as {
    service_name: string;
    deployment_environment: string;
    points: number | string;
    last_seen: string;
  }[];
  const services = [
    ...new Set(metadata.map((row) => row.service_name).filter(Boolean)),
  ];
  const environments = [
    ...new Set(
      metadata.map((row) => row.deployment_environment).filter(Boolean),
    ),
  ];
  const points = metadata.reduce((sum, row) => sum + Number(row.points), 0);
  const lastSeen = metadata
    .map((row) => row.last_seen)
    .sort()
    .at(-1);
  const lastSeenUtc = lastSeen ? normalizeDateTime(lastSeen) : "";
  const catalog = [
    {
      ...definition,
      points,
      services: services.length,
      containers: 0,
      lastSeen: lastSeenUtc,
      lastValue: summaryRows[0]?.value ?? null,
    },
  ];
  return {
    summary: {
      totalPoints: points,
      metricCount: 1,
      serviceCount: services.length,
      environmentCount: environments.length,
      lastSeen: lastSeenUtc || null,
    },
    facets: {
      metrics: [{ value: definition.name, count: points }],
      services: services.map((value) => ({ value, count: 0 })),
      environments: environments.map((value) => ({ value, count: 0 })),
      containers: [] as { value: string; count: number }[],
      entityKinds: [] as { value: string; count: number }[],
    },
    catalog,
    series: buildSeries(rows, {
      bucketCount: input.bucketCount,
      bucketSizeMs: Math.max(
        Math.ceil(
          (endAtUtc.getTime() - startAtUtc.getTime()) / input.bucketCount,
        ),
        1,
      ),
      startAtUtc,
      endAtUtc,
    }),
    samples: [] as {
      metricName: string;
      type: string;
      unit: string;
      serviceName: string;
      environment: string;
      containerName: string;
      entityKind: string;
      time: string;
      value: number | null;
    }[],
    startAtUtc: startAtUtc.toISOString(),
    endAtUtc: endAtUtc.toISOString(),
  };
};

export { getMetricView };
