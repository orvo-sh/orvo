import { describe, expect, test } from "vitest";

import {
  createLogStateSearchParams,
  resolveLogStateFromSearchParams,
  resolveLogVolumeBucketCount,
} from "../../../src/routes/(dashboard)/a/[app_id]/logs/state";

describe("logs state helpers", () => {
  test("defaults to last 24 hours when search params are empty", () => {
    const state = resolveLogStateFromSearchParams(new URLSearchParams());

    expect(state.live).toBe(false);
    expect(state.selectedLogId).toBeNull();
    expect(state.time).toEqual({
      kind: "preset",
      preset: "last_24_hours",
    });
    expect(state.filters.activeFilters).toEqual([]);
  });

  test("parses range, live mode, selected log id, and filters", () => {
    const searchParams = new URLSearchParams({
      live: "true",
      log: "log_123",
      start: "2026-06-28T09:00:00.000Z",
      end: "2026-06-28T10:00:00.000Z",
    });
    searchParams.append(
      "filter",
      JSON.stringify({
        attribute: "service",
        operator: "eq",
        value: "api",
      }),
    );

    const state = resolveLogStateFromSearchParams(searchParams);

    expect(state.live).toBe(true);
    expect(state.selectedLogId).toBe("log_123");
    expect(state.time).toEqual({
      kind: "range",
      start: "2026-06-28T09:00:00.000Z",
      end: "2026-06-28T10:00:00.000Z",
    });
    expect(state.filters.activeFilters).toEqual([
      {
        attribute: "service",
        operator: "eq",
        value: "api",
      },
    ]);
  });

  test("ignores invalid filter payloads", () => {
    const searchParams = new URLSearchParams({
      preset: "last_hour",
    });
    searchParams.append("filter", "not-json");
    searchParams.append("filter", JSON.stringify({ value: "missing-fields" }));

    const state = resolveLogStateFromSearchParams(searchParams);

    expect(state.time).toEqual({
      kind: "preset",
      preset: "last_hour",
    });
    expect(state.filters.activeFilters).toEqual([]);
  });

  test("serializes and round-trips search params", () => {
    const searchParams = createLogStateSearchParams(
      true,
      {
        kind: "range",
        start: "2026-06-28T09:00:00.000Z",
        end: "2026-06-28T10:30:00.000Z",
      },
      {
        activeFilters: [
          {
            attribute: "service",
            operator: "eq",
            value: "api",
          },
        ],
      },
      "log_456",
    );

    const state = resolveLogStateFromSearchParams(searchParams);

    expect(state).toEqual({
      live: true,
      selectedLogId: "log_456",
      time: {
        kind: "range",
        start: "2026-06-28T09:00:00.000Z",
        end: "2026-06-28T10:30:00.000Z",
      },
      filters: {
        activeFilters: [
          {
            attribute: "service",
            operator: "eq",
            value: "api",
          },
        ],
      },
    });
  });

  test("resolves volume bucket counts within supported bounds", () => {
    expect(
      resolveLogVolumeBucketCount(
        new Date("2026-06-28T09:00:00.000Z"),
        new Date("2026-06-28T09:05:00.000Z"),
      ),
    ).toBe(24);

    expect(
      resolveLogVolumeBucketCount(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-07-15T00:00:00.000Z"),
      ),
    ).toBe(72);

    expect(
      resolveLogVolumeBucketCount(
        new Date("2026-06-28T09:00:00.000Z"),
        new Date("2026-06-28T13:00:00.000Z"),
      ),
    ).toBe(120);
  });
});
