import { describe, expect, test } from "vitest";

import { createQueryBindings } from "$lib/server/services/shared/query-builders";
import {
  buildWhereClause,
  collectLogJsonFilterAttributes,
  resolveLogFilterAttributeDefinition,
} from "$lib/server/services/logs/methods/shared";

describe("logs query building helpers", () => {
  test("maps static and dynamic attributes to definitions", () => {
    expect(resolveLogFilterAttributeDefinition("service")).toMatchObject({
      kind: "column",
      column: "service_name",
    });
    expect(resolveLogFilterAttributeDefinition("resource.host.name")).toMatchObject({
      kind: "dynamic",
      mapColumn: "resource_attributes",
      mapKey: "host.name",
    });
    expect(resolveLogFilterAttributeDefinition("scope.sdk.name")).toMatchObject({
      kind: "dynamic",
      mapColumn: "scope_attributes",
      mapKey: "sdk.name",
    });
    expect(resolveLogFilterAttributeDefinition("attribute.payload.user.id")).toMatchObject({
      kind: "dynamic",
      mapColumn: "log_attributes",
      mapKey: "payload",
      jsonPath: ["user", "id"],
    });
    expect(resolveLogFilterAttributeDefinition("log.payload.user.id")).toMatchObject({
      kind: "dynamic",
      mapColumn: "log_attributes",
      mapKey: "payload",
      jsonPath: ["user", "id"],
    });
  });

  test("returns null for unknown attributes", () => {
    expect(resolveLogFilterAttributeDefinition("totally.unknown")).toBeNull();
    expect(resolveLogFilterAttributeDefinition("attribute.")).toBeNull();
  });

  test("collects nested JSON log attribute paths", () => {
    const attributes = collectLogJsonFilterAttributes([
      {
        key: "payload",
        value: '{"user":{"id":"123","profile":{"email":"x@test.com"}}}',
      },
      {
        key: "payload",
        value: '{"user":{"id":"123","profile":{"email":"x@test.com"}}}',
      },
      {
        key: "plain",
        value: "not-json",
      },
    ]);

    expect(attributes.map((attribute) => attribute.key)).toEqual([
      "attribute.payload.user.id",
      "attribute.payload.user.profile.email",
    ]);
  });

  test("builds a scoped where clause with filters and cursor", () => {
    const bindings = createQueryBindings();

    const whereClause = buildWhereClause(
      bindings,
      "app_123",
      {
        time: {
          kind: "range",
          start: "2026-06-28T09:00:00.000Z",
          end: "2026-06-28T11:00:00.000Z",
        },
        activeFilters: [
          {
            attribute: "service",
            operator: "eq",
            value: "api",
          },
          {
            attribute: "resource.host.name",
            operator: "contains",
            value: "web",
          },
          {
            attribute: "unknown.attribute",
            operator: "eq",
            value: "ignored",
          },
        ],
      },
      {
        cursor: {
          id: "log_123",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      },
    );

    expect(whereClause).toContain("app_id =");
    expect(whereClause).toContain("service_name =");
    expect(whereClause).toContain("mapContains(resource_attributes");
    expect(whereClause).toContain("cursor_id");
    expect(whereClause).not.toContain("unknown.attribute");
    expect(Object.values(bindings.query_params)).toContain("app_123");
    expect(Object.values(bindings.query_params)).toContain("api");
    expect(Object.values(bindings.query_params)).toContain("web");
  });
});
