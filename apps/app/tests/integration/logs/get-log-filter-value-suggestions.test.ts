import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { useLogsServiceHarness } from "./support";

describe("LogsService.getLogFilterValueSuggestions", () => {
  const harness = useLogsServiceHarness();

  test("returns grouped values for static attributes ordered by count", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        service_name: "api",
      }),
      buildLog({
        app_id: "app_a",
        service_name: "api",
      }),
      buildLog({
        app_id: "app_a",
        service_name: "worker",
      }),
    ]);

    const result = await harness.logsService.getLogFilterValueSuggestions(
      {
        attribute: "service",
        query: "",
        limit: 10,
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.values).toEqual([
      { value: "api", count: 2 },
      { value: "worker", count: 1 },
    ]);
  });

  test("returns grouped values for nested JSON attributes", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        log_attributes: {
          payload: '{"user":{"id":"123"}}',
        },
      }),
      buildLog({
        app_id: "app_a",
        log_attributes: {
          payload: '{"user":{"id":"123"}}',
        },
      }),
      buildLog({
        app_id: "app_a",
        log_attributes: {
          payload: '{"user":{"id":"999"}}',
        },
      }),
    ]);

    const result = await harness.logsService.getLogFilterValueSuggestions(
      {
        attribute: "attribute.payload.user.id",
        query: "1",
        limit: 10,
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.values).toEqual([{ value: "123", count: 2 }]);
  });

  test("scopes value suggestions by app", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        resource_attributes: {
          "host.name": "web-01",
        },
      }),
      buildLog({
        app_id: "app_b",
        resource_attributes: {
          "host.name": "private-01",
        },
      }),
    ]);

    const result = await harness.logsService.getLogFilterValueSuggestions(
      {
        attribute: "resource.host.name",
        query: "",
        limit: 10,
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.values).toEqual([{ value: "web-01", count: 1 }]);
  });

  test("rejects unknown attributes", async () => {
    const result = await harness.logsService.getLogFilterValueSuggestions(
      {
        attribute: "unknown.attribute",
        query: "",
        limit: 10,
      },
      { appId: "app_a" },
    );

    expect(result).toEqual({
      success: false,
      error: "Unknown log filter attribute.",
    });
  });
});
