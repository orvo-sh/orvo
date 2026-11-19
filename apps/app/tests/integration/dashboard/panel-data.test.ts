import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  startClickHouseContainer,
  getClickHouseTestClient,
  applyClickHouseMigrations,
  stopClickHouseContainer,
} from "../../helpers/clickhouse";
import { createTestLogger } from "../../helpers/logger";
import { createGetPanelData } from "$lib/server/services/dashboard/methods/get-panel-data";
import type { DashboardPanel } from "$lib/dashboards/schema";

describe("dashboard panel queries", () => {
  let container: Awaited<ReturnType<typeof startClickHouseContainer>>;
  let clickhouse: ReturnType<typeof getClickHouseTestClient>;
  const panel: DashboardPanel = {
    id: "test",
    title: "Test",
    visualization: "time_series",
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    source: "traces",
    measure: "count",
    aggregation: "avg",
    metricName: "",
    service: "",
    environment: "",
    groupBy: "none",
    unit: "auto",
    text: "",
  };
  beforeAll(async () => {
    container = await startClickHouseContainer();
    clickhouse = getClickHouseTestClient(container);
    await applyClickHouseMigrations(clickhouse);
    await clickhouse.command({
      query: `INSERT INTO traces_raw (id, app_id, received_at, expires_at, trace_id, span_id, name, start_time, end_time, duration_ns, service_name, deployment_environment, status_code) SELECT toString(number), if(number < 4, 'app_a', 'app_b'), now64(3), now64(3) + INTERVAL 7 DAY, toString(number), toString(number), 'GET /', now64(3) - INTERVAL 10 MINUTE, now64(3) - INTERVAL 10 MINUTE, (number + 1) * 1000000, if(number % 2 = 0, 'api', 'worker'), 'production', if(number = 0, 2, 1) FROM numbers(6)`,
    });
    await clickhouse.command({
      query: `INSERT INTO logs_raw (id, app_id, received_at, expires_at, timestamp, observed_timestamp, body, severity_number, severity_text, service_name, deployment_environment) SELECT toString(number), if(number < 4, 'app_a', 'app_b'), now64(3), now64(3) + INTERVAL 7 DAY, now64(3) - INTERVAL 10 MINUTE, now64(3), 'Message', if(number = 0, 17, 9), if(number = 0, 'ERROR', 'INFO'), 'api', 'production' FROM numbers(6)`,
    });
    await clickhouse.command({
      query: `INSERT INTO metrics_raw (id, app_id, received_at, expires_at, time, metric_name, metric_type, value_double, service_name, deployment_environment, host_name) SELECT toString(number), if(number < 4, 'app_a', 'app_b'), now64(3), now64(3) + INTERVAL 7 DAY, now64(3) - INTERVAL 10 MINUTE, 'test.gauge', 'gauge', (number + 1) * 10, 'api', 'production', if(number % 2 = 0, 'host-a', 'host-b') FROM numbers(6)`,
    });
  });
  afterAll(async () => {
    if (container) await stopClickHouseContainer(container, clickhouse);
  });
  const query = (patch: Partial<DashboardPanel> = {}) =>
    createGetPanelData({ clickhouse, logger: createTestLogger() as never })(
      { panel: { ...panel, ...patch }, timeRange: "last_hour" },
      { appId: "app_a" },
    );
  test("counts only this app's spans and groups by service", async () => {
    expect(await query()).toMatchObject({
      success: true,
      data: { series: [expect.objectContaining({ name: "All", value: 4 })] },
    });
    expect(await query({ groupBy: "service" })).toMatchObject({
      success: true,
      data: {
        series: [
          expect.objectContaining({ name: "api", value: 2 }),
          expect.objectContaining({ name: "worker", value: 2 }),
        ],
      },
    });
    expect(
      await query({ service: "api", environment: "production" }),
    ).toMatchObject({
      success: true,
      data: { series: [expect.objectContaining({ value: 2 })] },
    });
  });
  test("computes error percentages and latency over the full range", async () => {
    expect(await query({ measure: "error_rate" })).toMatchObject({
      success: true,
      data: { unit: "%", series: [expect.objectContaining({ value: 25 })] },
    });
    expect(
      await query({ measure: "duration", aggregation: "avg" }),
    ).toMatchObject({
      success: true,
      data: { unit: "ms", series: [expect.objectContaining({ value: 2.5 })] },
    });
  });
  test("loads logs and log error rates with parameterized filters", async () => {
    const result = await query({ source: "logs", visualization: "logs" });
    expect(result.success && result.data.logs).toHaveLength(4);
    expect(
      await query({ source: "logs", measure: "error_rate" }),
    ).toMatchObject({
      success: true,
      data: { series: [expect.objectContaining({ value: 25 })] },
    });
    const escaped = await query({
      source: "logs",
      service: "api' OR 1=1 --",
      visualization: "logs",
    });
    expect(escaped.success && escaped.data.logs).toEqual([]);
  });
  test("queries metric values and groups by host", async () => {
    expect(
      await query({
        source: "metrics",
        measure: "value",
        metricName: "test.gauge",
        aggregation: "avg",
      }),
    ).toMatchObject({
      success: true,
      data: { series: [expect.objectContaining({ value: 25 })] },
    });
    expect(
      await query({
        source: "metrics",
        measure: "value",
        metricName: "test.gauge",
        groupBy: "host",
        aggregation: "max",
      }),
    ).toMatchObject({
      success: true,
      data: {
        series: [
          expect.objectContaining({ name: "host-a", value: 30 }),
          expect.objectContaining({ name: "host-b", value: 40 }),
        ],
      },
    });
  });
  test("sums per-call token usage, ignores missing values, and scopes model/provider breakdowns", async () => {
    await clickhouse.command({
      query: `INSERT INTO traces_raw (id, app_id, received_at, expires_at, trace_id, span_id, name, start_time, end_time, duration_ns, service_name, span_attributes)
      SELECT concat('token_', toString(number)), if(number < 4, 'app_tokens', 'other_app'), now64(3), now64(3) + INTERVAL 7 DAY, toString(number), toString(number), 'chat', now64(3) - INTERVAL 1 MINUTE, now64(3), 1000000, 'orvo-app-server',
      map('gen_ai.usage.input_tokens', if(number = 3, 'unknown', toString([100,200,50,0,9999][number + 1])), 'gen_ai.usage.output_tokens', if(number = 3, 'unknown', toString([20,40,10,0,9999][number + 1])), 'gen_ai.usage.total_tokens', if(number = 3, 'unknown', toString([120,240,60,0,19998][number + 1])), 'gen_ai.response.model', if(number = 2, 'model-b', 'model-a'), 'gen_ai.provider.name', if(number = 2, 'anthropic', 'openai')) FROM numbers(5)`,
    });
    const run = (patch: Partial<DashboardPanel>) =>
      createGetPanelData({ clickhouse, logger: createTestLogger() as never })(
        {
          panel: { ...panel, measure: "input_tokens", ...patch },
          timeRange: "last_hour",
        },
        { appId: "app_tokens" },
      );
    expect(await run({})).toMatchObject({
      success: true,
      data: {
        unit: "tokens",
        series: [expect.objectContaining({ value: 350 })],
      },
    });
    expect(await run({ measure: "output_tokens" })).toMatchObject({
      data: { series: [expect.objectContaining({ value: 70 })] },
    });
    expect(await run({ measure: "total_tokens" })).toMatchObject({
      data: { series: [expect.objectContaining({ value: 420 })] },
    });
    expect(await run({ groupBy: "model" })).toMatchObject({
      data: {
        series: [
          expect.objectContaining({ name: "model-a", value: 300 }),
          expect.objectContaining({ name: "model-b", value: 50 }),
        ],
      },
    });
    expect(await run({ provider: "openai", model: "model-a" })).toMatchObject({
      data: { series: [expect.objectContaining({ value: 300 })] },
    });
    expect(await run({ model: "model-a' OR 1=1 --" })).toMatchObject({
      data: { series: [] },
    });
  });
});
