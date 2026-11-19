import { expect, test } from "vitest";
import { normalizeDateTime } from "$lib/server/services/shared/query-builders";
import { normalizeDateTime as normalizeMetricDateTime } from "$lib/server/services/metrics/shared";

test("database timestamps remain the same instant in every server timezone", () => {
  const timezone = process.env.TZ;
  try {
    for (const zone of [
      "UTC",
      "Africa/Harare",
      "America/New_York",
      "Asia/Kolkata",
    ]) {
      process.env.TZ = zone;
      for (const value of [
        "2026-11-19 16:00:00.123",
        "2026-11-19T16:00:00.123Z",
        "2026-11-19T18:00:00.123+02:00",
        "2026-11-19 11:00:00.123-0500",
      ]) {
        expect(new Date(normalizeDateTime(value)).getTime()).toBe(
          Date.parse("2026-11-19T16:00:00.123Z"),
        );
        expect(normalizeMetricDateTime(value)).toBe(normalizeDateTime(value));
      }
    }
  } finally {
    if (timezone === undefined) delete process.env.TZ;
    else process.env.TZ = timezone;
  }
});

test("normalization preserves high-resolution timestamps and does not double-append a timezone", () => {
  expect(normalizeDateTime("2026-11-19 16:00:00.123456789")).toBe(
    "2026-11-19T16:00:00.123456789Z",
  );
  expect(normalizeDateTime("2026-11-19T16:00:00.123456789Z")).toBe(
    "2026-11-19T16:00:00.123456789Z",
  );
  expect(normalizeDateTime("2026-11-19T18:00:00+02:00")).toBe(
    "2026-11-19T18:00:00+02:00",
  );
  expect(normalizeDateTime(new Date("2026-11-19T16:00:00Z"))).toBe(
    "2026-11-19T16:00:00.000Z",
  );
});
