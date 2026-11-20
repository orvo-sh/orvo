import { GRID_COLUMNS, GRID_GAP, GRID_ROW_HEIGHT } from "./grid";
import type { DashboardPanel } from "./schema";

const reviewDashboardLayout = (
  panels: DashboardPanel[],
  canvasWidth?: number,
) => {
  const ordered = panels.toSorted((a, b) => a.y - b.y || a.x - b.x);
  const stacked =
    canvasWidth !== undefined && canvasWidth > 0 && canvasWidth < 640;
  const warnings: Array<{ panelIds: string[]; message: string }> = [];
  for (const panel of ordered) {
    if (
      ["time_series", "bar", "table", "logs"].includes(panel.visualization) &&
      panel.h < 6
    )
      warnings.push({
        panelIds: [panel.id],
        message: `${panel.title} is only ${panel.h * (GRID_ROW_HEIGHT + GRID_GAP) - GRID_GAP}px tall, including its header. Give charts and detailed lists at least 6 rows, usually 7–9.`,
      });
    if (panel.visualization === "stat" && panel.h > 5)
      warnings.push({
        panelIds: [panel.id],
        message: `${panel.title} is a single-value stat taking ${panel.h} rows. Prefer 3–4 rows unless the user requested a larger highlight.`,
      });
    if (
      !stacked &&
      canvasWidth &&
      ["time_series", "bar", "table", "logs"].includes(panel.visualization) &&
      (panel.w * (canvasWidth + GRID_GAP)) / GRID_COLUMNS - GRID_GAP < 300
    )
      warnings.push({
        panelIds: [panel.id],
        message: `${panel.title} is narrower than 300px on the current canvas. Consider fewer panels in this row.`,
      });
  }
  const rowStarts = [...new Set(ordered.map((panel) => panel.y))];
  let occupiedUntil = 0;
  for (const y of rowStarts) {
    const starting = ordered.filter((panel) => panel.y === y);
    if (y > occupiedUntil)
      warnings.push({
        panelIds: starting.map((panel) => panel.id),
        message: `${y - occupiedUntil} completely empty grid rows before ${starting[0].title}. Remove accidental vertical gaps.`,
      });
    const occupiedColumns = ordered
      .filter((panel) => panel.y <= y && panel.y + panel.h > y)
      .reduce((total, panel) => total + panel.w, 0);
    if (occupiedColumns < GRID_COLUMNS)
      warnings.push({
        panelIds: starting.map((panel) => panel.id),
        message: `The row starting at y=${y} uses ${occupiedColumns}/${GRID_COLUMNS} columns. Fill the row or keep this space only when it serves an intentional grouping.`,
      });
    if (
      starting.length > 1 &&
      new Set(starting.map((panel) => panel.h)).size > 1
    )
      warnings.push({
        panelIds: starting.map((panel) => panel.id),
        message: `Panels starting at y=${y} have different heights. Align their bottom edges unless an intentional spanning layout needs this.`,
      });
    occupiedUntil = Math.max(
      occupiedUntil,
      ...starting.map((panel) => panel.y + panel.h),
    );
  }
  return {
    canvasWidth:
      canvasWidth && canvasWidth > 0 ? Math.round(canvasWidth) : null,
    mode: stacked ? "stacked" : "grid",
    totalRows: Math.max(0, ...ordered.map((panel) => panel.y + panel.h)),
    readingOrder: ordered.map((panel) => ({
      id: panel.id,
      title: panel.title,
      visualization: panel.visualization,
      x: panel.x,
      y: panel.y,
      w: panel.w,
      h: panel.h,
    })),
    warnings,
    note: "These are design suggestions, not visual proof. Review the overall hierarchy and keep intentional exceptions. Below 640px canvas width panels stack in visual reading order; desktop geometry is preserved.",
  };
};

export { reviewDashboardLayout };
