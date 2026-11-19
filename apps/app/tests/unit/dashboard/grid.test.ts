import { describe, expect, test } from "vitest";
import { nextPosition, overlaps, placePanel } from "$lib/dashboards/grid";
import {
  dashboardDefinitionSchema,
  type DashboardPanel,
} from "$lib/dashboards/schema";

const panel = (
  id: string,
  x: number,
  y: number,
  w = 12,
  h = 6,
): DashboardPanel => ({
  id,
  title: id,
  visualization: "stat",
  x,
  y,
  w,
  h,
  source: "traces",
  measure: "count",
  aggregation: "avg",
  metricName: "",
  service: "",
  environment: "",
  groupBy: "none",
  unit: "auto",
  text: "",
});
const valid = (panels: DashboardPanel[]) =>
  dashboardDefinitionSchema.safeParse({ name: "Test", panels }).success;

describe("dashboard grid", () => {
  test("snaps to integer cells and clamps all edges", () => {
    const [result] = placePanel([panel("a", 0, 0)], "a", {
      x: 100.4,
      y: -3.6,
      w: 8.4,
      h: 3.4,
    });
    expect(result).toMatchObject({ x: 16, y: 0, w: 8, h: 3 });
  });
  test("pushes cascading collisions down, leaves other columns alone, and preserves input", () => {
    const original = [
      panel("a", 0, 0),
      panel("b", 0, 6),
      panel("c", 0, 12),
      panel("d", 12, 0),
    ];
    const moved = placePanel(original, "a", { x: 0, y: 6, w: 12, h: 8 });
    expect(moved.map((p) => [p.id, p.y])).toEqual([
      ["a", 6],
      ["b", 14],
      ["c", 20],
      ["d", 0],
    ]);
    expect(original[0].y).toBe(0);
    expect(valid(moved)).toBe(true);
  });
  test("fills the first available gap when adding a panel", () => {
    expect(
      nextPosition([panel("a", 0, 0, 6, 3), panel("b", 12, 0, 12, 6)], 6, 3),
    ).toEqual({ x: 6, y: 0, w: 6, h: 3 });
  });
  test("keeps repeated moves and resizes non-overlapping and serializable", () => {
    let panels = Array.from({ length: 16 }, (_, index) =>
      panel(String(index), (index % 4) * 6, Math.floor(index / 4) * 4, 6, 4),
    );
    for (let i = 0; i < 80; i++) {
      const target = panels[i % panels.length];
      panels = placePanel(panels, target.id, {
        x: (i * 7) % 25,
        y: (i * 3) % 30,
        w: 4 + (i % 16),
        h: 3 + (i % 10),
      });
      expect(valid(panels)).toBe(true);
      expect(
        panels.every((a, index) =>
          panels.slice(index + 1).every((b) => !overlaps(a, b)),
        ),
      ).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(panels))).toEqual(panels);
  });
  test("rejects overlaps and duplicate IDs at the save boundary", () => {
    expect(valid([panel("a", 0, 0), panel("b", 4, 0)])).toBe(false);
    expect(valid([panel("a", 0, 0), panel("a", 12, 0)])).toBe(false);
  });
});
