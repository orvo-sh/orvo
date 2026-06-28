import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { useLogsServiceHarness } from "./support";

describe("LogsService.getLogFilterAttributes", () => {
  const harness = useLogsServiceHarness();

  test("returns static and dynamic filter attributes for the app", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        resource_attributes: {
          "host.name": "web-01",
        },
        scope_attributes: {
          "sdk.name": "otel-js",
        },
        log_attributes: {
          payload: '{"user":{"id":"123"}}',
          request_id: "req_123",
        },
      }),
    ]);

    const result = await harness.logsService.getLogFilterAttributes({
      appId: "app_a",
    });

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "service" }),
        expect.objectContaining({ key: "resource.host.name" }),
        expect.objectContaining({ key: "scope.sdk.name" }),
        expect.objectContaining({ key: "attribute.payload" }),
        expect.objectContaining({ key: "attribute.payload.user.id" }),
        expect.objectContaining({ key: "attribute.request_id" }),
      ]),
    );
  });

  test("scopes discovered dynamic attributes by app", async () => {
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
          "cluster.name": "private-cluster",
        },
      }),
    ]);

    const result = await harness.logsService.getLogFilterAttributes({
      appId: "app_a",
    });

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "resource.host.name" }),
      ]),
    );
    expect(result.data.attributes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "resource.cluster.name" }),
      ]),
    );
  });
});
