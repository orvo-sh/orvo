import { MetricsService } from "$lib/server/services/metrics";
import { queryMetric } from "$lib/server/services/metrics/metric-query";
import {
  getDefaultMetricAggregation,
  derivedMetrics,
} from "$lib/metric-definitions";
import { beforeAll, afterAll, test, expect } from "vitest";
import { createTestLogger } from "../../helpers/logger";
import {
  applyClickHouseMigrations,
  startClickHouseContainer,
  getClickHouseTestClient,
  stopClickHouseContainer,
} from "../../helpers/clickhouse";

let container: Awaited<ReturnType<typeof startClickHouseContainer>>;
let client: ReturnType<typeof getClickHouseTestClient>;
let service: MetricsService;
const start = new Date("2026-11-19T00:00:00Z");
const end = new Date("2026-11-19T00:05:00Z");
const date = (value: string) => value.replace("T", " ").replace("Z", "");
const request = { appId: "test", start, end };

beforeAll(async () => {
  container = await startClickHouseContainer();
  client = getClickHouseTestClient(container);
  await applyClickHouseMigrations(client);
  service = new MetricsService(client, createTestLogger() as never);
  const metrics = {
    app_id: "test",
    received_at: date(start.toISOString()),
    expires_at: "2036-01-01 00:00:00",
    metric_unit: "1",
    service_name: "checkout",
    deployment_environment: "production",
    scope_name: "test",
    start_time: date(start.toISOString()),
    resource_attributes: { instance: "one" },
    attributes: { queue: "payments" },
    flags: 0,
  };
  const time = (value: string) => `2026-11-19 ${value}`;
  await client.insert({
    table: "metrics_raw",
    format: "JSONEachRow",
    values: [
      {
        ...metrics,
        metric_name: "queue.depth",
        metric_type: "gauge",
        value_double: 20,
        time: time("00:01:00"),
      },
      {
        ...metrics,
        metric_name: "queue.depth",
        metric_type: "gauge",
        value_double: 40,
        time: time("00:02:00"),
      },
      {
        ...metrics,
        app_id: "other",
        metric_name: "queue.depth",
        metric_type: "gauge",
        value_double: 99999,
        time: time("00:02:00"),
      },
      ...[100, 120, 5, 15].map((value, index) => ({
        ...metrics,
        metric_name: "payment.count",
        metric_type: "sum",
        is_monotonic: true,
        aggregation_temporality: "cumulative",
        value_double: value,
        time: time(index === 0 ? "23:59:00" : `00:0${index}:00`).replace(
          "2026-11-19 23:59",
          "2026-11-18 23:59",
        ),
        start_time: "2026-11-18 00:00:00",
      })),
      ...[3, 7].map((value, index) => ({
        ...metrics,
        metric_name: "delta.count",
        metric_type: "sum",
        is_monotonic: true,
        aggregation_temporality: "delta",
        value_double: value,
        time: time(`00:0${index + 1}:00`),
      })),
      ...[1, 2].map((index) => ({
        ...metrics,
        metric_name: "latency.hist",
        metric_type: "histogram",
        aggregation_temporality: "delta",
        histogram_count: 4,
        histogram_sum: 400,
        histogram_bucket_counts: [1, 2, 1],
        histogram_explicit_bounds: [100, 200],
        time: time(`00:0${index}:00`),
      })),
      ...[1, 2].map((index) => ({
        ...metrics,
        metric_name: "cumulative.hist",
        metric_type: "histogram",
        aggregation_temporality: "cumulative",
        histogram_count: 4 * index,
        histogram_sum: 400 * index,
        histogram_bucket_counts: [index, 2 * index, index],
        histogram_explicit_bounds: [100, 200],
        time: time(index === 1 ? "23:59:00" : "00:02:00").replace(
          "2026-11-19 23:59",
          "2026-11-18 23:59",
        ),
        start_time: "2026-11-18 00:00:00",
      })),
      {
        ...metrics,
        metric_name: "container.cpu.utilization",
        metric_type: "gauge",
        value_double: 0.8,
        container_id: "container-one",
        container_name: "worker",
        entity_kind: "container",
        time: time("00:02:00"),
      },
      {
        ...metrics,
        metric_name: "container.memory.usage.total",
        metric_type: "gauge",
        value_int: 200,
        container_id: "container-one",
        container_name: "worker",
        entity_kind: "container",
        time: time("00:02:00"),
      },
      {
        ...metrics,
        metric_name: "container.memory.usage.limit",
        metric_type: "gauge",
        value_int: 1000,
        container_id: "container-one",
        container_name: "worker",
        entity_kind: "container",
        time: time("00:02:00"),
      },
    ],
  });
  await client.insert({
    table: "traces_raw",
    format: "JSONEachRow",
    values: [100, 200, 300, 400, 9000, 9000, 9000].map((duration, index) => ({
      app_id: "test",
      id: `trace-${index}`,
      trace_id: `trace-${index}`,
      span_id: `span-${index}`,
      received_at: date(start.toISOString()),
      expires_at: "2036-01-01 00:00:00",
      service_name: index >= 4 ? "background" : "checkout",
      deployment_environment: "production",
      scope_name: "test",
      name: index >= 4 ? "background work" : "/checkout",
      kind: index < 4 ? 2 : [1, 3, 5][index - 4],
      status_code: index >= 3 ? 2 : 1,
      duration_ns: duration * 1000000,
      start_time: `2026-11-19 00:0${(index % 4) + 1}:00`,
      end_time: `2026-11-19 00:0${(index % 4) + 1}:01`,
      span_attributes: { route: "/checkout" },
    })),
  });
});
afterAll(async () => {
  if (container) await stopClickHouseContainer(container, client);
});
const value = async (
  name: string,
  aggregation: Parameters<typeof queryMetric>[1]["aggregation"],
) => (await queryMetric(client, { ...request, name, aggregation }))[0]?.value;

test("request metrics, container metrics and ingested metrics share the catalog and explorer", async () => {
  const catalog = await service.getMetricCatalog(
    {
      time: {
        kind: "range",
        start: start.toISOString(),
        end: end.toISOString(),
      },
    },
    { appId: "test" },
  );
  expect(catalog.success).toBe(true);
  if (!catalog.success) throw new Error(catalog.error);
  expect(
    catalog.data.catalog.find((item) => item.name === "$request.count")?.points,
  ).toBe(4);
  for (const metric of derivedMetrics)
    expect(catalog.data.catalog.some((item) => item.name === metric.name)).toBe(
      true,
    );
  expect(catalog.data.catalog.some((item) => item.name === "queue.depth")).toBe(
    true,
  );
  expect(
    catalog.data.catalog.some(
      (item) => item.name === "orvo.container.cpu.utilization",
    ),
  ).toBe(false);
  for (const name of [
    "$request.count",
    "$request.duration",
    "$request.error_rate",
    "queue.depth",
    "payment.count",
    "latency.hist",
  ]) {
    const metric = catalog.data.catalog.find((item) => item.name === name)!;
    const result = await service.getMetricsExplorer(
      {
        time: {
          kind: "range",
          start: start.toISOString(),
          end: end.toISOString(),
        },
        metricName: name,
        aggregation: getDefaultMetricAggregation(metric),
        groupBy: "service",
        bucketCount: 10,
      },
      { appId: "test" },
    );
    expect(result.success, JSON.stringify(result)).toBe(true);
    if (result.success) expect(result.data.series.length).toBeGreaterThan(0);
  }
});

test("derived metrics measure incoming requests and exclude internal, client, and consumer spans", async () => {
  expect(await value("$request.count", "total")).toBe(4);
  expect(await value("$request.count", "rate_per_min")).toBeCloseTo(0.8);
  expect(await value("$request.error_count", "total")).toBe(1);
  expect(await value("$request.error_rate", "avg")).toBe(25);
  expect(await value("$request.success_rate", "avg")).toBeUndefined();
  expect(await value("$request.duration", "avg")).toBe(250);
  expect(await value("$request.duration", "max")).toBe(400);
  expect(await value("$request.apdex", "avg")).toBeUndefined();
  expect(await value("container.cpu.utilization", "avg")).toBe(0.8);
  expect(
    await value("orvo.container.memory.utilization", "avg"),
  ).toBeUndefined();
  expect(
    await value("orvo.container.reporting_age", "current"),
  ).toBeUndefined();
  expect(
    await queryMetric(client, {
      ...request,
      name: "$request.count",
      aggregation: "total",
      appId: "missing",
    }),
  ).toEqual([]);
});

test("counter resets and delta temporality are evaluated per series", async () => {
  expect(await value("payment.count", "increase")).toBe(35);
  expect(await value("payment.count", "rate_per_min")).toBe(7);
  expect(await value("delta.count", "increase")).toBe(10);
  expect(await value("payment.count", "total")).toBe(15);
});

test("histogram averages, counts and percentiles use interval bucket distributions", async () => {
  expect(await value("latency.hist", "avg")).toBe(100);
  expect(await value("latency.hist", "count")).toBe(8);
  expect(await value("latency.hist", "p50")).toBe(150);
  expect(await value("latency.hist", "p95")).toBe(200);
  expect(await value("cumulative.hist", "count")).toBe(4);
  expect(await value("cumulative.hist", "avg")).toBe(100);
  expect(await value("cumulative.hist", "p50")).toBe(150);
});

test("metric selection includes all supported types and keeps source details internal", async () => {
  const options = await service.getAlertMetricOptions(
    { kind: "metrics" },
    { appId: "test" },
  );
  expect(options.success).toBe(true);
  if (!options.success) throw new Error(options.error);
  expect(
    options.data.values.some((item) => item.value === "$request.error_rate"),
  ).toBe(true);
  expect(
    options.data.values.find((item) => item.value === "payment.count")?.type,
  ).toBe("sum");
  const keys = await service.getAlertMetricOptions(
    { kind: "attributeKeys", metricName: "$request.duration" },
    { appId: "test" },
  );
  expect(
    keys.success &&
      keys.data.values.some((item) => item.value === "operation.name"),
  ).toBe(true);
  expect(
    options.data.values.some((item) => item.value === "$request.apdex"),
  ).toBe(false);
});

test("request filters exclude background processing services", async () => {
  const options = await service.getAlertMetricOptions(
    { kind: "services", metricName: "$request.count" },
    { appId: "test" },
  );
  expect(options.success).toBe(true);
  if (!options.success) throw new Error(options.error);
  expect(options.data.values.map((item) => item.value)).toEqual(["checkout"]);
  for (const metric of derivedMetrics) {
    expect(
      await queryMetric(client, {
        ...request,
        name: metric.name,
        aggregation: metric.aggregation,
        scope: { services: { include: ["background"], exclude: [] } },
      }),
    ).toEqual([]);
  }
});

test("metric discovery ignores unrelated metric names and blank attribute keys", async () => {
  const result = await service.getAlertMetricOptions(
    {
      kind: "metrics",
      metricName: "error rate",
      attributeKey: " ",
      query: "error",
      limit: 100,
    },
    { appId: "test" },
  );
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  expect(
    result.data.values.some((item) => item.value === "$request.error_rate"),
  ).toBe(true);
  const native = await service.getAlertMetricOptions(
    { kind: "metrics", metricName: "$request.count", query: "queue" },
    { appId: "test" },
  );
  expect(
    native.success &&
      native.data.values.some((item) => item.value === "queue.depth"),
  ).toBe(true);
  const invalid = await service.getAlertMetricOptions(
    {
      kind: "attributeValues",
      metricName: "$request.count",
      attributeKey: " ",
    },
    { appId: "test" },
  );
  expect(invalid.success).toBe(false);
});

test("service, environment, and resource attributes are discoverable and filter through the same API", async () => {
  const keys = await service.getAlertMetricOptions(
    { kind: "attributeKeys", metricName: "queue.depth" },
    { appId: "test" },
  );
  expect(keys.success).toBe(true);
  if (!keys.success) throw new Error(keys.error);
  expect(keys.data.values.map((item) => item.value)).toEqual(
    expect.arrayContaining([
      "service.name",
      "deployment.environment",
      "instance",
      "queue",
    ]),
  );
  for (const [key, expected] of [
    ["service.name", "checkout"],
    ["deployment.environment", "production"],
    ["instance", "one"],
  ]) {
    const options = await service.getAlertMetricOptions(
      { kind: "attributeValues", metricName: "queue.depth", attributeKey: key },
      { appId: "test" },
    );
    expect(
      options.success &&
        options.data.values.some((item) => item.value === expected),
    ).toBe(true);
    const rows = await queryMetric(client, {
      ...request,
      name: "queue.depth",
      aggregation: "avg",
      attributes: { [key]: { include: [expected], exclude: [] } },
    });
    expect(rows[0]?.value).toBe(30);
  }
  expect(
    await queryMetric(client, {
      ...request,
      name: "$request.count",
      aggregation: "total",
      attributes: { "service.name": { include: ["background"], exclude: [] } },
    }),
  ).toEqual([]);
  const requests = await queryMetric(client, {
    ...request,
    name: "$request.count",
    aggregation: "total",
    attributes: {
      "service.name": { include: ["checkout"], exclude: [] },
      "deployment.environment": { include: ["production"], exclude: [] },
    },
  });
  expect(requests[0]?.value).toBe(4);
});
