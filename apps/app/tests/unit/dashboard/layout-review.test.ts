import { expect, test } from "vitest";
import { reviewDashboardLayout } from "$lib/dashboards/layout-review";
import { createDashboardPanel } from "$lib/dashboards/panels";

const panel = (
  id: string,
  visualization: "stat" | "time_series",
  x: number,
  y: number,
  w: number,
  h: number,
) => ({
  ...createDashboardPanel([], visualization),
  id,
  title: id,
  x,
  y,
  w,
  h,
});

test("review flags cramped charts, oversized stats, gaps, and uneven rows at the actual canvas width", () => {
  const report = reviewDashboardLayout(
    [
      panel("Chart", "time_series", 0, 0, 6, 3),
      panel("Stat", "stat", 6, 0, 6, 7),
      panel("Bottom", "time_series", 0, 12, 24, 7),
    ],
    900,
  );
  const warnings = report.warnings.map((warning) => warning.message).join("\n");
  expect(warnings).toContain("narrower than 300px");
  expect(warnings).toContain("at least 6 rows");
  expect(warnings).toContain("single-value stat");
  expect(warnings).toContain("12/24 columns");
  expect(warnings).toContain("different heights");
  expect(warnings).toContain("5 completely empty grid rows");
});

test("aligned summary cards and larger charts pass and stack in visual reading order", () => {
  const panels = [
    panel("Right chart", "time_series", 12, 3, 12, 7),
    panel("Stat 3", "stat", 12, 0, 6, 3),
    panel("Stat 1", "stat", 0, 0, 6, 3),
    panel("Stat 4", "stat", 18, 0, 6, 3),
    panel("Left chart", "time_series", 0, 3, 12, 7),
    panel("Stat 2", "stat", 6, 0, 6, 3),
  ];
  expect(reviewDashboardLayout(panels, 1000).warnings).toEqual([]);
  const mobile = reviewDashboardLayout(panels, 375);
  expect(mobile.mode).toBe("stacked");
  expect(mobile.warnings).toEqual([]);
  expect(mobile.readingOrder.map((panel) => panel.id)).toEqual([
    "Stat 1",
    "Stat 2",
    "Stat 3",
    "Stat 4",
    "Left chart",
    "Right chart",
  ]);
});
