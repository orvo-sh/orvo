import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  resolveTimeFilter,
  timeFilterSchema,
} from "$lib/core/time-filter";

describe("core time filter helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves preset windows relative to the current time", () => {
    expect(
      resolveTimeFilter({
        kind: "preset",
        preset: "last_hour",
      }),
    ).toEqual({
      start: new Date("2026-06-28T09:00:00.000Z"),
      end: new Date("2026-06-28T10:00:00.000Z"),
    });
  });

  test("resolves today from UTC midnight", () => {
    expect(
      resolveTimeFilter({
        kind: "preset",
        preset: "today",
      }),
    ).toEqual({
      start: new Date("2026-06-28T00:00:00.000Z"),
      end: new Date("2026-06-28T10:00:00.000Z"),
    });
  });

  test("returns explicit ranges unchanged", () => {
    expect(
      resolveTimeFilter({
        kind: "range",
        start: "2026-06-28T08:00:00.000Z",
        end: "2026-06-28T09:30:00.000Z",
      }),
    ).toEqual({
      start: new Date("2026-06-28T08:00:00.000Z"),
      end: new Date("2026-06-28T09:30:00.000Z"),
    });
  });

  test("rejects ranges where start is after end", () => {
    const parsed = timeFilterSchema.safeParse({
      kind: "range",
      start: "2026-06-28T11:00:00.000Z",
      end: "2026-06-28T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});
